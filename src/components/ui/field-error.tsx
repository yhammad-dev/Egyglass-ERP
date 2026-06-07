export function FieldError({ message }: { message?: string }) {
  return message ? <p className="text-sm text-red-500 mt-1">{message}</p> : null
}
