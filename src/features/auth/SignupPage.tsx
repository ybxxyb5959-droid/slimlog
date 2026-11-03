import { useState } from 'react'
import { useNavigate } from 'react-router'

import { Logo } from '@/components/brand/Logo'
import { PageHeader } from '@/components/common/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import { AuthShell } from './AuthShell'

export function SignupPage() {
  const navigate = useNavigate()
  const [f, setF] = useState({ email: '', password: '', confirm: '', nickname: '' })
  const [touched, setTouched] = useState(false)
  const errors = {
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email) ? null : '이메일 형식을 확인해 주세요.',
    password: f.password.length >= 8 && /\d/.test(f.password) && /[a-zA-Z]/.test(f.password) ? null : '영문과 숫자를 섞어 8자 이상 입력해 주세요.',
    confirm: f.confirm && f.confirm === f.password ? null : '비밀번호가 같지 않아요.',
    nickname: f.nickname.trim().length >= 2 ? null : '닉네임은 2자 이상이에요.',
  }
  const valid = Object.values(errors).every((e) => !e)
  const field = (key: keyof typeof f, label: string, type = 'text', autoComplete?: string) => (
    <div>
      <Label htmlFor={`signup-${key}`}>{label}</Label>
      <Input
        id={`signup-${key}`}
        type={type}
        autoComplete={autoComplete}
        value={f[key]}
        aria-invalid={touched && !!errors[key]}
        onChange={(e) => setF((s) => ({ ...s, [key]: e.target.value }))}
      />
      {touched && errors[key] && (
        <p role="alert" className="mt-1.5 text-[13px] text-danger">
          {errors[key]}
        </p>
      )}
    </div>
  )

  return (
    <AuthShell>
      <PageHeader title="이메일로 가입" back="/login" actions={<Logo variant="symbol" size={28} />} />
      <form
        noValidate
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          setTouched(true)
          if (valid) navigate('/consent')
        }}
      >
        {field('email', '이메일', 'email', 'email')}
        {field('password', '비밀번호', 'password', 'new-password')}
        {field('confirm', '비밀번호 확인', 'password', 'new-password')}
        {field('nickname', '닉네임 (커뮤니티에 보여요)', 'text', 'nickname')}
        <Button type="submit" size="lg" className="mt-2 w-full">
          다음
        </Button>
        <p className="text-center text-[12px] text-text-subtle">목업 · 입력한 정보는 어디에도 저장되지 않아요.</p>
      </form>
    </AuthShell>
  )
}
