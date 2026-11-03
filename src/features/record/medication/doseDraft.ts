import { localInputToIso, toDateTimeLocalValue } from '@/lib/date'
import type { DoseInput } from '@/services/doses'
import type { Dose, InjectionSite, MedicationId } from '@/types/domain'

export interface DoseDraft {
  medicationId: MedicationId | null
  doseMg: number | null
  administeredAt: string // datetime-local 값
  site: InjectionSite | null
  memo: string
}

export function draftFromDose(dose?: Dose, fallbackMed: MedicationId = 'mounjaro'): DoseDraft {
  return {
    medicationId: dose?.medicationId ?? fallbackMed,
    doseMg: dose?.doseMg ?? null,
    administeredAt: toDateTimeLocalValue(dose ? new Date(dose.administeredAt) : new Date()),
    site: dose?.site ?? null,
    memo: dose?.memo ?? '',
  }
}

export function draftToInput(d: DoseDraft): Partial<DoseInput> {
  return {
    medicationId: d.medicationId ?? undefined,
    doseMg: d.doseMg ?? undefined,
    administeredAt: d.administeredAt ? localInputToIso(d.administeredAt) : undefined,
    site: d.site ?? undefined,
    memo: d.memo || undefined,
  }
}
