// Le email del Supabase locale finiscono in Mailpit (supabase/config.toml, [local_smtp]).

const MAILPIT = process.env.MAILPIT_URL ?? 'http://127.0.0.1:54324'

interface MessageSummary {
  ID: string
  Subject: string
}

/** Aspetta l'email per `to` con quell'oggetto e restituisce il primo link che contiene `path`. */
export async function linkFromEmail(to: string, subject: RegExp, path: string): Promise<string> {
  const deadline = Date.now() + 30_000
  while (Date.now() < deadline) {
    const search = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`)
    const { messages } = (await search.json()) as { messages: MessageSummary[] }
    const message = messages.find((m) => subject.test(m.Subject))
    if (message) {
      const detail = (await (await fetch(`${MAILPIT}/api/v1/message/${message.ID}`)).json()) as {
        HTML: string
      }
      const hrefs = [...detail.HTML.matchAll(/href="([^"]+)"/g)].map((m) =>
        (m[1] ?? '').replaceAll('&amp;', '&'),
      )
      const link = hrefs.find((href) => href.includes(path))
      if (link) return link
      throw new Error(`Nessun link verso ${path} nell'email "${message.Subject}"`)
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error(`Nessuna email "${String(subject)}" per ${to}`)
}
