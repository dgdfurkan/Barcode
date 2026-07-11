import { ContainerScroll } from '@/components/ui/container-scroll-animation'

export default function HeroScrollDemo() {
  return (
    <div className="flex flex-col overflow-hidden bg-[#030303]">
      <ContainerScroll
        titleComponent={
          <>
            <h1 className="text-3xl md:text-4xl font-semibold text-white">
              Jet Barkod ile operasyonlarınız
              <br />
              <span className="text-3xl md:text-[4.5rem] font-bold mt-2 leading-none bg-gradient-to-r from-[#0052FF] to-[#4D7CFF] bg-clip-text text-transparent">
                tek panelde
              </span>
            </h1>
          </>
        }
      >
        <img
          src="/logo.png"
          alt="Jet Barkod uygulama önizlemesi"
          height={720}
          width={1400}
          className="mx-auto rounded-2xl object-contain h-full w-full bg-[#0f172a] p-8 md:p-12"
          draggable={false}
        />
      </ContainerScroll>
    </div>
  )
}
