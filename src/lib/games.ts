import { and, asc, eq, inArray } from 'drizzle-orm';
import type { Database } from './db';
import { games, categories, publishers } from '../../db/schema';
import type { Category, Game, Publisher } from '../types/game';

const gameSelection = {
    id: games.id,
    title: games.title,
    description: games.description,
    starRating: games.starRating,
    categoryId: categories.id,
    categoryName: categories.name,
    publisherId: publishers.id,
    publisherName: publishers.name,
};

type GameSelectionRow = {
    id: number;
    title: string;
    description: string;
    starRating: number | null;
    categoryId: number | null;
    categoryName: string | null;
    publisherId: number | null;
    publisherName: string | null;
};

function mapGame(row: GameSelectionRow): Game {
    return {
        id: row.id,
        title: row.title,
        description: row.description,
        starRating: row.starRating,
        category:
            row.categoryId !== null && row.categoryName !== null
                ? { id: row.categoryId, name: row.categoryName }
                : null,
        publisher:
            row.publisherId !== null && row.publisherName !== null
                ? { id: row.publisherId, name: row.publisherName }
                : null,
    };
}

function baseGamesQuery(db: Database) {
    return db
        .select(gameSelection)
        .from(games)
        .leftJoin(categories, eq(games.categoryId, categories.id))
        .leftJoin(publishers, eq(games.publisherId, publishers.id));
}

export interface GameFilters {
    categoryIds?: number[];
    publisherId?: number;
}

/** All games ordered by title.
 *
 * @param db Injectable database instance used to query game records.
 * @returns Every game with its category and publisher, ordered alphabetically by title.
 */
export async function getAllGames(db: Database): Promise<Game[]> {
    const rows = await baseGamesQuery(db).orderBy(asc(games.title));
    return rows.map(mapGame);
}

/** Games matching category and publisher filters, ordered by title.
 *
 * @param db Injectable database instance used to query game records.
 * @param filters Optional category and publisher IDs to filter by. Multiple category IDs match any selected category.
 * @returns Matching games with their category and publisher, ordered alphabetically by title.
 */
export async function getFilteredGames(db: Database, filters: GameFilters): Promise<Game[]> {
    const validCategoryIds = [...new Set(filters.categoryIds ?? [])].filter((id) => Number.isInteger(id) && id > 0);
    const validPublisherId =
        filters.publisherId !== undefined && Number.isInteger(filters.publisherId) && filters.publisherId > 0
            ? filters.publisherId
            : undefined;
    const conditions = [
        validCategoryIds.length > 0 ? inArray(games.categoryId, validCategoryIds) : undefined,
        validPublisherId !== undefined ? eq(games.publisherId, validPublisherId) : undefined,
    ].filter((condition) => condition !== undefined);

    const query = baseGamesQuery(db);
    const rows =
        conditions.length === 0
            ? await query.orderBy(asc(games.title))
            : await query.where(and(...conditions)).orderBy(asc(games.title));

    return rows.map(mapGame);
}

/** All categories ordered by name.
 *
 * @param db Injectable database instance used to query category records.
 * @returns Category options ordered alphabetically by name.
 */
export async function getAllCategories(db: Database): Promise<Category[]> {
    return db
        .select({ id: categories.id, name: categories.name })
        .from(categories)
        .orderBy(asc(categories.name));
}

/** All publishers ordered by name.
 *
 * @param db Injectable database instance used to query publisher records.
 * @returns Publisher options ordered alphabetically by name.
 */
export async function getAllPublishers(db: Database): Promise<Publisher[]> {
    return db
        .select({ id: publishers.id, name: publishers.name })
        .from(publishers)
        .orderBy(asc(publishers.name));
}

/** All game ids ordered by title.
 *
 * @param db Injectable database instance used to query game records.
 * @returns Game IDs ordered by their game titles.
 */
export async function getAllGameIds(db: Database): Promise<number[]> {
    const rows = await db.select({ id: games.id }).from(games).orderBy(asc(games.title));
    return rows.map((row) => row.id);
}

/** A single game by id, or null when it does not exist.
 *
 * @param db Injectable database instance used to query game records.
 * @param id Game ID to look up.
 * @returns The matching game with its category and publisher, or null when no game exists.
 */
export async function getGameById(db: Database, id: number): Promise<Game | null> {
    const row = await baseGamesQuery(db).where(eq(games.id, id)).get();
    return row ? mapGame(row) : null;
}
