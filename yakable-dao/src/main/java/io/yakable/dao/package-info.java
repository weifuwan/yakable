/**
 * Yakable persistence implementation.
 *
 * <p>The only persistence path is:</p>
 * <pre>
 * Domain/Application Repository -> RepositoryImpl -> Mapper -> Entity
 * </pre>
 *
 * <p>Entities model database rows, Mappers correspond to physical tables,
 * and Repository implementations own persistence orchestration,
 * transaction boundaries and model conversion.</p>
 */
package io.yakable.dao;
