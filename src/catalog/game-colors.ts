// I sei colori del gioco come accenti (docs/design.md), dai token di src/index.css.

const GAME_COLOR_VAR: Record<string, string> = {
  Red: 'var(--color-game-red)',
  Green: 'var(--color-game-green)',
  Blue: 'var(--color-game-blue)',
  Purple: 'var(--color-game-purple)',
  Black: 'var(--color-game-black)',
  Yellow: 'var(--color-game-yellow)',
}

export function gameColor(color: string): string {
  return GAME_COLOR_VAR[color] ?? 'var(--muted-foreground)'
}

/** Sfondo per una barretta: tinta unita o sfumatura per le carte multicolore. */
export function colorBar(colors: readonly string[]): string {
  const values = colors.map(gameColor)
  return values.length > 1 ? `linear-gradient(90deg, ${values.join(', ')})` : (values[0] ?? '')
}
