import { Hammer } from 'lucide-react'
import { Link, useLocation } from 'react-router'

import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState } from '@/components/common/StateViews'
import { Button } from '@/components/ui/button'

/** 1차 디자인 승인 후 구현할 화면의 자리 */
export function ComingSoonPage({ title }: { title: string }) {
  const { pathname } = useLocation()
  const parent = '/' + pathname.split('/')[1]
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
