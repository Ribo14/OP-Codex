import { useEffect, useMemo, useState } from 'react'
import { useSession } from '@/account/session'
import type { CatalogCard } from '@/catalog/catalog-data'
import { listDecks } from '@/decks/decks-api'
import { getSupabase } from '@/lib/supabase'
import {
  approximateStarter,
  fromDeck,
  fromRecipe,
  type Recipe,
  type TableDeck,
} from './table-decks'

// I mazzi tra cui scegliere al tavolo (RIB-99): prima i Deck dell'utente (anche offline, dalla
// copia sul dispositivo), poi gli Starter Deck con la composizione di set_recipes.

/** Starter Deck da offrire se set_recipes non risponde (offline o tabella vuota in locale). */
const FALLBACK_STARTERS = ['ST-01', 'ST-02', 'ST-03', 'ST-04']
const NO_DECKS: TableDeck[] = []

async function fetchRecipes(): Promise<{ setCode: string; recipe: Recipe }[]> {
  try {
    const { data, error } = await getSupabase()
      .from('set_recipes')
      .select('set_code, cards')
      .order('set_code')
    if (error) return []
    // JSON dal database: si controlla la forma prima di usarlo.
    return data.flatMap((row) => {
      const cards: unknown = row.cards
      if (typeof cards !== 'object' || cards === null) return []
      const recipe: Record<string, number> = {}
      for (const [code, copies] of Object.entries(cards)) {
        if (typeof copies === 'number') recipe[code] = copies
      }
      return [{ setCode: row.set_code, recipe }]
    })
  } catch {
    return []
  }
}

export function useTableDecks(catalog: readonly CatalogCard[] | null): {
  decks: TableDeck[]
  loading: boolean
} {
  const session = useSession()
  const userId = session.status === 'signedIn' ? session.user.id : null
  const byCode = useMemo(() => new Map((catalog ?? []).map((c) => [c.cardCode, c])), [catalog])
  // I Deck letti, con l'utente a cui appartengono: cambiando account non si mostrano quelli vecchi.
  const [loaded, setLoaded] = useState<{ userId: string; decks: TableDeck[] } | null>(null)
  const [recipes, setRecipes] = useState<{ setCode: string; recipe: Recipe }[] | null>(null)

  useEffect(() => {
    let current = true
    void fetchRecipes().then((list) => {
      if (current) setRecipes(list)
    })
    return () => {
      current = false
    }
  }, [])

  useEffect(() => {
    if (!userId || byCode.size === 0) return
    let current = true
    listDecks().then(
      (list) => {
        if (!current) return
        setLoaded({
          userId,
          decks: list.flatMap(({ deck, cards }) => {
            const d = fromDeck(
              deck.id,
              deck.name,
              deck.leaderCode,
              deck.leaderPrintId,
              cards,
              byCode,
            )
            return d ? [d] : []
          }),
        })
      },
      () => {
        if (current) setLoaded({ userId, decks: [] })
      },
    )
    return () => {
      current = false
    }
  }, [userId, byCode])

  // Senza account solo gli Starter; con l'account si aspettano i suoi Deck.
  const own =
    session.status === 'loading'
      ? null
      : userId === null
        ? NO_DECKS
        : loaded?.userId === userId
          ? loaded.decks
          : null

  const decks = useMemo(() => {
    if (!catalog) return []
    const fromRecipes = (recipes ?? []).flatMap(({ setCode, recipe }) => {
      const d = fromRecipe(setCode, recipe, byCode)
      return d ? [d] : []
    })
    const starters =
      fromRecipes.length > 0
        ? fromRecipes
        : FALLBACK_STARTERS.flatMap((code) => {
            const d = approximateStarter(code, catalog)
            return d ? [d] : []
          })
    return [...(own ?? []), ...starters]
  }, [catalog, own, recipes, byCode])

  return { decks, loading: !catalog || own === null || recipes === null }
}
