(function () {
    'use strict';

    let broadcastApiAvailable = true;

    /** Oturum token'ını Authorization başlığına ekler. */
    function authHeaders(base) {
        const h = Object.assign({}, base || {});
        const t = window.jetbarkodAuth?.get?.();
        if (t) h.Authorization = 'Bearer ' + t;
        return h;
    }

    /** Kanal yoklamasında tablo başına çekilecek kolonlar. */
    const POLL_COLUMNS = {
        users: 'id,username,premium_features,chat_messages,last_chat_update,counting_data,trial_end,is_active,is_admin',
    };

    function parseFilter(filter) {
        if (!filter || typeof filter !== 'string') return null;
        const m = filter.match(/^(\w+)=eq\.(.+)$/);
        if (!m) return null;
        return { column: m[1], value: m[2] };
    }

    class VpsPollChannel {
        constructor(name, client, baseUrl) {
            this.name = name;
            this.client = client;
            this.baseUrl = baseUrl;
            this._pgHandlers = [];
            this._bcHandlers = [];
            this._timer = null;
            this._lastSnapshot = null;
            this._subscribed = false;
        }

        on(type, filter, callback) {
            if (type === 'postgres_changes') {
                this._pgHandlers.push({ filter, callback });
            } else if (type === 'broadcast') {
                this._bcHandlers.push({ filter, callback });
            }
            return this;
        }

        async send(payload) {
            if (payload?.event === 'refresh-page' && payload?.payload?.username) {
                await fetch(`${this.baseUrl}/api/broadcast/refresh`, {
                    method: 'POST',
                    headers: authHeaders({ 'Content-Type': 'application/json' }),
                    body: JSON.stringify({ username: payload.payload.username }),
                });
            }
            return { status: 'ok' };
        }

        subscribe(statusCb) {
            this._subscribed = true;
            setTimeout(() => statusCb && statusCb('SUBSCRIBED'), 0);
            this._startPoll();
            return this;
        }

        _startPoll() {
            if (this._timer) return;
            this._timer = setInterval(() => this._poll().catch(() => {}), 4000);
            this._poll().catch(() => {});
        }

        async _poll() {
            for (const h of this._pgHandlers) {
                await this._pollPostgres(h);
            }
            for (const h of this._bcHandlers) {
                await this._pollBroadcast(h);
            }
        }

        async _pollPostgres(handler) {
            const table = handler.filter?.table;
            if (!table) return;

            // DİKKAT: users tablosunda parola kolonlarına kimsenin SELECT
            // yetkisi yok. PostgreSQL'de kolon bazlı yetki varken `SELECT *`
            // tamamen reddedilir — bu yüzden users için kolonlar açıkça
            // sayılıyor. Diğer tablolarda * sorun değil.
            const cols = POLL_COLUMNS[table] || '*';
            let query = this.client.from(table).select(cols);
            const parsed = parseFilter(handler.filter?.filter);
            if (parsed) {
                query = query.eq(parsed.column, parsed.value);
            }

            const { data, error } = await query;
            if (error) return;

            const snap = JSON.stringify(data || []);
            if (this._lastSnapshot && this._lastSnapshot !== snap) {
                const eventType = handler.filter?.event === 'INSERT' ? 'INSERT' : 'UPDATE';
                handler.callback({
                    eventType,
                    new: Array.isArray(data) ? data[data.length - 1] : data,
                    old: null,
                    schema: handler.filter?.schema || 'public',
                    table,
                });
            }
            this._lastSnapshot = snap;
        }

        async _pollBroadcast(handler) {
            if (!broadcastApiAvailable) return;
            if (handler.filter?.event !== 'refresh-page') return;
            const m = this.name.match(/^user-refresh-(.+)$/);
            if (!m) return;
            const username = m[1];
            const res = await fetch(
                `${this.baseUrl}/api/broadcast/refresh/${encodeURIComponent(username)}`,
                { headers: authHeaders() }
            );
            if (res.status === 404 || res.status === 401 || res.status === 403) {
                // Uç yok ya da oturum yok — yoklamayı durdur, konsolu kirletme.
                broadcastApiAvailable = false;
                return;
            }
            if (!res.ok) return;
            const json = await res.json();
            if (json?.pending) {
                handler.callback({
                    event: 'refresh-page',
                    payload: json.payload || { username },
                });
            }
        }

        async unsubscribe() {
            this._subscribed = false;
            if (this._timer) {
                clearInterval(this._timer);
                this._timer = null;
            }
        }
    }

    function wrapStorage(baseUrl) {
        return {
            from(bucket) {
                return {
                    async upload(filePath, file, options = {}) {
                        const res = await fetch(
                            `${baseUrl}/storage/v1/object/${encodeURIComponent(bucket)}/${filePath}`,
                            {
                                method: 'POST',
                                headers: {
                                    'Content-Type':
                                        file.type || options.contentType || 'application/octet-stream',
                                },
                                body: file,
                            }
                        );
                        const json = await res.json().catch(() => ({}));
                        if (!res.ok) {
                            return { data: null, error: { message: json.error || res.statusText } };
                        }
                        return { data: json, error: null };
                    },
                    getPublicUrl(path) {
                        return {
                            data: {
                                publicUrl: `${baseUrl}/storage/v1/object/public/${encodeURIComponent(bucket)}/${path}`,
                            },
                        };
                    },
                };
            },
        };
    }

    window.wrapVpsSupabaseClient = function wrapVpsSupabaseClient(client, baseUrl) {
        const root = (baseUrl || '').replace(/\/$/, '');
        const originalChannel = client.channel.bind(client);

        client.channel = function channel(name, opts) {
            return new VpsPollChannel(name, client, root);
        };

        client.removeChannel = async function removeChannel(ch) {
            if (ch && typeof ch.unsubscribe === 'function') {
                await ch.unsubscribe();
            }
        };

        client.storage = wrapStorage(root);
        client.realtime = client.realtime || {};
        client.realtime.channel = client.channel;

        return client;
    };
})();
