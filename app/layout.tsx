import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "谱间 · 乐谱工作室",
  description: "导入、转换与练习乐谱",
};

export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}