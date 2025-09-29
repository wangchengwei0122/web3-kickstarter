import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

const categories = ['科技', '艺术', '教育', '环境', '社会影响', '生活方式'];

const formHint = '填写项目信息将帮助社区快速了解你的愿景。暂不对接链上，静态展示表单即可。';

const controlClass =
  'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100';

export default function CreatePage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-6 py-12">
      <header className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-widest text-sky-500">Create</p>
        <h1 className="text-3xl font-semibold text-slate-900">发起全新的众筹项目</h1>
        <p className="text-sm text-slate-500">{formHint}</p>
      </header>

      <form className="grid gap-8" aria-labelledby="create-project-form">
        <Card className="rounded-[28px] border-0 bg-white shadow-xl shadow-slate-900/5 ring-1 ring-slate-900/5">
          <CardHeader className="px-8">
            <CardTitle className="text-xl text-slate-900">项目概览</CardTitle>
            <CardDescription className="text-sm text-slate-500">
              提供标题、简介与详细描述，帮助支持者了解你的核心理念。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 px-8 pb-8">
            <div className="grid gap-2">
              <label className="text-sm font-medium text-slate-700" htmlFor="title">
                项目标题
              </label>
              <Input
                id="title"
                placeholder="例如：下一代可持续能源电池"
                className="h-11 rounded-xl px-4"
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium text-slate-700" htmlFor="tagline">
                宣传语 / 简短介绍
              </label>
              <Input
                id="tagline"
                placeholder="一句话告诉大家你的项目亮点"
                className="h-11 rounded-xl px-4"
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium text-slate-700" htmlFor="description">
                项目详情
              </label>
              <textarea
                id="description"
                rows={5}
                placeholder="展开介绍项目背景、愿景与核心计划..."
                className={`${controlClass} resize-none`}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[28px] border-0 bg-white shadow-xl shadow-slate-900/5 ring-1 ring-slate-900/5">
          <CardHeader className="px-8">
            <CardTitle className="text-xl text-slate-900">融资目标</CardTitle>
            <CardDescription className="text-sm text-slate-500">
              设置众筹目标金额与关键节点，确保时间线清晰可信。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 px-8 pb-8">
            <div className="grid gap-2 sm:grid-cols-2 sm:gap-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700" htmlFor="goal">
                  目标金额 (ETH)
                </label>
                <Input id="goal" placeholder="10" className="h-11 rounded-xl px-4" />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700" htmlFor="deadline">
                  截止日期
                </label>
                <Input id="deadline" type="date" className="h-11 rounded-xl px-4" />
              </div>
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium text-slate-700" htmlFor="milestone">
                关键里程碑
              </label>
              <textarea
                id="milestone"
                rows={3}
                placeholder="列出达成目标所需的阶段性任务或成果..."
                className={`${controlClass} resize-none`}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[28px] border-0 bg-white shadow-xl shadow-slate-900/5 ring-1 ring-slate-900/5">
          <CardHeader className="px-8">
            <CardTitle className="text-xl text-slate-900">展示与分类</CardTitle>
            <CardDescription className="text-sm text-slate-500">
              上传封面、选择分类并提供对外展示的媒体链接。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 px-8 pb-8">
            <div className="grid gap-2 sm:grid-cols-2 sm:gap-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700" htmlFor="category">
                  项目分类
                </label>
                <select id="category" className={controlClass} defaultValue="科技">
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700" htmlFor="cover">
                  封面图片 URL
                </label>
                <Input id="cover" placeholder="https://..." className="h-11 rounded-xl px-4" />
              </div>
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium text-slate-700" htmlFor="metadata">
                元数据 URI (可选)
              </label>
              <Input
                id="metadata"
                placeholder="ipfs://your-metadata.json"
                className="h-11 rounded-xl px-4"
              />
            </div>
            <p className="text-xs text-slate-400">
              提示：正式发布前，请确保元数据可被公开访问并符合平台规范。
            </p>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4 rounded-[28px] border border-dashed border-slate-300 p-6 text-sm text-slate-500">
          <span className="text-base font-medium text-slate-800">暂存说明</span>
          <p>
            当前页面为静态示例，未连接链上调用或后端接口。填写完成后，你可以点击“预览项目”查看展示效果，或返回探索页继续浏览社区想法。
          </p>
          <div className="flex flex-wrap gap-3">
            <Button className="rounded-full px-6">预览项目</Button>
            <Button asChild variant="outline" className="rounded-full px-6">
              <Link href="/">返回首页</Link>
            </Button>
          </div>
        </div>
      </form>
    </main>
  );
}
