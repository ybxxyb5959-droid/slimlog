import { useNavigate, useSearchParams } from 'react-router'
import { toast } from 'sonner'

import { PageHeader } from '@/components/common/PageHeader'
import { Card } from '@/components/ui/card'

import { CustomFoodForm } from './mealParts'

export function CustomFoodPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  return (
    <>
      <PageHeader title="직접 음식 등록" description="영양 성분표를 보고 입력해 주세요" back="/record/meal/search" />
      <Card className="md:max-w-lg">
        <CustomFoodForm
          initialName={params.get('name') ?? ''}
          onSaved={(f) => {
            toast.success(`‘${f.name}’을 내 음식에 등록했어요`)
            navigate(`/record/meal/food/${f.id}`, { replace: true })
          }}
        />
      </Card>
    </>
  )
}
