/** Il valore testuale di un campo del modulo ('' se manca). */
export function field(form: FormData, name: string): string {
  const value = form.get(name)
  return typeof value === 'string' ? value : ''
}
