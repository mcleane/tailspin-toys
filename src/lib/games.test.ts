import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDatabase } from '../../db/test-helpers';
import { categories, publishers, games } from '../../db/schema';
import type { Database } from './db';
import {
    getAllCategories,
    getAllGames,
    getAllGameIds,
    getAllPublishers,
    getFilteredGames,
    getGameById,
} from './games';

async function seedGames(db: Database, count: number): Promise<void> {
    const [category] = await db
        .insert(categories)
        .values({ name: 'Strategy', description: 'cat' })
        .returning({ id: categories.id });
    const [publisher] = await db
        .insert(publishers)
        .values({ name: 'Pub One', description: 'pub' })
        .returning({ id: publishers.id });

    // Insert titles in reverse-alphabetical order to prove ordering is applied.
    for (let i = count; i >= 1; i--) {
        await db.insert(games).values({
            title: `Game ${String(i).padStart(2, '0')}`,
            description: `Description ${i}`,
            starRating: 4.2,
            categoryId: category.id,
            publisherId: publisher.id,
        });
    }
}

async function seedFilterGames(db: Database): Promise<{
    categories: Record<'strategy' | 'party', number>;
    publishers: Record<'pubOne' | 'pubTwo', number>;
}> {
    const [strategy] = await db
        .insert(categories)
        .values({ name: 'Strategy', description: 'Strategic games' })
        .returning({ id: categories.id });
    const [party] = await db
        .insert(categories)
        .values({ name: 'Party', description: 'Party games' })
        .returning({ id: categories.id });
    const [pubOne] = await db
        .insert(publishers)
        .values({ name: 'Pub One', description: 'Publisher one' })
        .returning({ id: publishers.id });
    const [pubTwo] = await db
        .insert(publishers)
        .values({ name: 'Pub Two', description: 'Publisher two' })
        .returning({ id: publishers.id });

    await db.insert(games).values([
        {
            title: 'Beta Strategy',
            description: 'Strategy from publisher one',
            starRating: 4.1,
            categoryId: strategy.id,
            publisherId: pubOne.id,
        },
        {
            title: 'Alpha Party',
            description: 'Party from publisher one',
            starRating: 4.4,
            categoryId: party.id,
            publisherId: pubOne.id,
        },
        {
            title: 'Gamma Strategy',
            description: 'Strategy from publisher two',
            starRating: 3.8,
            categoryId: strategy.id,
            publisherId: pubTwo.id,
        },
    ]);

    return {
        categories: { strategy: strategy.id, party: party.id },
        publishers: { pubOne: pubOne.id, pubTwo: pubTwo.id },
    };
}

describe('games data-access helpers', () => {
    let db: Database;

    beforeEach(async () => {
        db = await createTestDatabase();
    });

    it('returns all games ordered by title', async () => {
        await seedGames(db, 3);
        const all = await getAllGames(db);
        expect(all.map((g) => g.title)).toEqual(['Game 01', 'Game 02', 'Game 03']);
        expect(all[0].category).toEqual({ id: expect.any(Number), name: 'Strategy' });
        expect(all[0].publisher).toEqual({ id: expect.any(Number), name: 'Pub One' });
    });

    it('returns all game ids ordered by title', async () => {
        await seedGames(db, 3);
        const ids = await getAllGameIds(db);
        const all = await getAllGames(db);
        expect(ids).toEqual(all.map((g) => g.id));
    });

    it('fetches a single game by id', async () => {
        await seedGames(db, 2);
        const ids = await getAllGameIds(db);
        const game = await getGameById(db, ids[0]);
        expect(game?.title).toBe('Game 01');
    });

    it('returns null for a non-existent game', async () => {
        await seedGames(db, 2);
        expect(await getGameById(db, 99999)).toBeNull();
    });

    it('returns category filter options ordered by name', async () => {
        await seedFilterGames(db);
        const options = await getAllCategories(db);
        expect(options.map((category) => category.name)).toEqual(['Party', 'Strategy']);
    });

    it('returns publisher filter options ordered by name', async () => {
        await seedFilterGames(db);
        const options = await getAllPublishers(db);
        expect(options.map((publisher) => publisher.name)).toEqual(['Pub One', 'Pub Two']);
    });

    it('filters games by any selected category id', async () => {
        const fixture = await seedFilterGames(db);
        const filtered = await getFilteredGames(db, {
            categoryIds: [fixture.categories.strategy, fixture.categories.party],
        });

        expect(filtered.map((game) => game.title)).toEqual(['Alpha Party', 'Beta Strategy', 'Gamma Strategy']);
    });

    it('filters games by a single publisher id', async () => {
        const fixture = await seedFilterGames(db);
        const filtered = await getFilteredGames(db, {
            publisherId: fixture.publishers.pubTwo,
        });

        expect(filtered.map((game) => game.title)).toEqual(['Gamma Strategy']);
    });

    it('combines category and publisher filters', async () => {
        const fixture = await seedFilterGames(db);
        const filtered = await getFilteredGames(db, {
            categoryIds: [fixture.categories.strategy],
            publisherId: fixture.publishers.pubOne,
        });

        expect(filtered.map((game) => game.title)).toEqual(['Beta Strategy']);
    });

    it('returns every game for empty or invalid filters', async () => {
        await seedFilterGames(db);
        const filtered = await getFilteredGames(db, {
            categoryIds: [0, -1],
            publisherId: Number.NaN,
        });

        expect(filtered.map((game) => game.title)).toEqual(['Alpha Party', 'Beta Strategy', 'Gamma Strategy']);
    });

    it('returns no games when valid filters have no matches', async () => {
        const fixture = await seedFilterGames(db);
        const filtered = await getFilteredGames(db, {
            categoryIds: [fixture.categories.party],
            publisherId: fixture.publishers.pubTwo,
        });

        expect(filtered).toEqual([]);
    });
});
