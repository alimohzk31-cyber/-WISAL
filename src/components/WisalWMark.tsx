interface WisalWMarkProps { size?: 'sidebar' | 'hero' }
/** Dedicated metallic asset; never the application's square icon. */
export default function WisalWMark({ size = 'hero' }: WisalWMarkProps) {
  return <div className={`wisal-w-mark wisal-w-mark--${size}`}>
    <img src={`${(import.meta as any).env.BASE_URL}assets/wisal-admin-w-metallic.png`} alt="W ذهبي وأزرق مجسم" draggable={false}/>
    <span className="wisal-w-mark__reflection" aria-hidden="true"/>
  </div>;
}
