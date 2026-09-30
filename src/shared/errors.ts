/**
 * The server's own explanation from a failed request. typesense-js wraps it as
 * "Request failed with HTTP code 400 | Server said: …", which is noise in a form.
 */
export function serverMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/^Request failed with HTTP code \d+ \| Server said: /, '');
}
