/**
 * Yakable persistence boundary.
 *
 * <p>Persistence rules:</p>
 * <ul>
 *     <li>one MyBatis-Plus BaseMapper per physical table;</li>
 *     <li>single-table queries and updates live in concrete DAO classes and use
 *     lambda wrappers;</li>
 *     <li>multi-table queries are declared on a Mapper and implemented in XML;</li>
 *     <li>Repository adapters translate Domain/Application models and orchestrate
 *     persistence, without another DAO interface/implementation pair.</li>
 * </ul>
 */
package io.yakable.dao;
