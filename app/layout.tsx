import type { Metadata } from "next";
import "./globals.css";
import "./simple-layout.css";
import "./flow-layout.css";
import "./mechanical.css";
import "./refinements.css";
import "./independent.css";
import "./cancel.css";
import "./safety.css";
import "./features.css";
import "./refresh.css";
export const metadata:Metadata={title:"投研项目工作台",description:"从会议材料、转写校正到项目表录入的内部投研工作台。"};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="zh-CN"><body>{children}</body></html>}
