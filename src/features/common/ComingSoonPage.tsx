import { Hammer } from 'lucide-react'
import { Link, useLocation } from 'react-router'

import { Logo } from '@/components/brand/Logo'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState } from '@/components/common/StateViews'
import { Button } from '@/components/ui/button'

/** 1차 디자인 승인 후 구현할 화면의 자리 */
export function ComingSoonPage({ title, brand = false }: { title: string; brand?: boolean }) {
  const { pathname } = useLocation()
  const parent = '/' + pathname.split('/')[1]
  if (brand)
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-background px-5">
        <Logo variant="vertical" size={80} />
        <EmptyState
          icon={Hammer}
          title={`${title} 화면은 다음 단계에서 만들어요`}
          description="1차 디자인 승인 후 구현합니다."
          action={
            <Button asChild variant="outline">
              <Link to="/home">홈으로</Link>
            </Button>
          }
          className="py-0"
        />
      </div>
    )
  return (
    <>
      <PageHeader title={title} back={parent !== pathname ? parent : undefined} />
      <EmptyState
        icon={Hammer}
        title="다음 단계에서 만들 화면이에요"
        description="1차 디자인 승인 후 구현합니다."
        action={
          <Button asChild variant="outline">
            <Link to="/home">홈으로</Link>
          </Button>
        }
      />
    </>
  )
}
