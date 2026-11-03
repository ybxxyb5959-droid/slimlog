import { MapPinOff } from 'lucide-react'
import { Link } from 'react-router'

import { EmptyState } from '@/components/common/StateViews'
import { Button } from '@/components/ui/button'

export function NotFoundPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background">
      <EmptyState
        icon={MapPinOff}
        title="페이지를 찾을 수 없어요"
        description="주소가 바뀌었거나 없는 페이지예요."
        action={
          <Button asChild>
            <Link to="/home">홈으로 가기</Link>
          </Button>
        }
      />
    </div>
  )
}
