import { ZodError } from 'zod';
export function errorMessage(error: unknown): string {
  if (error instanceof ZodError) {
    const message = error.issues[0]?.message;
    return message && !/^(Invalid|Too |Unrecognized|Expected)/.test(message)
      ? message
      : 'Confira os campos e o formato dos dados informados.';
  }
  if (
    error instanceof Error &&
    /Quota|DatabaseClosed|UnknownError|SecurityError|InvalidState/.test(error.name)
  ) {
    return 'Não foi possível salvar no aparelho. Confira o espaço livre e as permissões de armazenamento. Seus campos foram mantidos.';
  }
  return error instanceof Error ? error.message : 'Não foi possível concluir. Tente novamente.';
}
