<?php

/**
 * Test stub for OCA\OpenRegister\Service\ObjectService.
 *
 * Mirrors the minimal ObjectService surface (find / updateObject) that
 * OrderController resolves from the service container. Used only in
 * environments where the openregister runtime is not installed (e.g. bare CI
 * containers). Loaded by tests/bootstrap-unit.php when the real class is
 * absent, and replaced by the real class as soon as the openregister app is
 * installed alongside this app. NOT scanned by PHPCS.
 *
 * @category Test
 * @package  OCA\PetStore\Tests\Stubs\Service
 *
 * @author    Conduction Development Team <info@conduction.nl>
 * @copyright 2026 Conduction B.V.
 * @license   EUPL-1.2 https://joinup.ec.europa.eu/collection/eupl/eupl-text-eupl-12
 */

declare(strict_types=1);

namespace OCA\OpenRegister\Service;

use OCA\OpenRegister\Db\ObjectEntity;

if (class_exists(ObjectService::class) === false) {
    /**
     * Stub ObjectService — used only in standalone unit tests.
     */
    class ObjectService
    {

        /**
         * Find one object by id, optionally scoped to a register/schema.
         *
         * @param int|string                $id            Object id or UUID.
         * @param array<string, mixed>|null $_extend       Extend directives.
         * @param bool                      $files         Include files.
         * @param mixed                     $register      Register slug/id/entity.
         * @param mixed                     $schema        Schema slug/id/entity.
         * @param bool                      $_rbac         Apply RBAC.
         * @param bool                      $_multitenancy Apply multitenancy.
         *
         * @return ObjectEntity|null
         */
        public function find(
            int | string $id,
            ?array $_extend=[],
            bool $files=false,
            mixed $register=null,
            mixed $schema=null,
            bool $_rbac=true,
            bool $_multitenancy=true
        ): ?ObjectEntity {
            return null;
        }//end find()

        /**
         * Update an existing object.
         *
         * @param string               $objectId      Object id or UUID.
         * @param array<string, mixed> $data          Partial object data.
         * @param bool                 $_rbac         Apply RBAC.
         * @param bool                 $_multitenancy Apply multitenancy.
         *
         * @return ObjectEntity
         */
        public function updateObject(
            string $objectId,
            array $data,
            bool $_rbac=true,
            bool $_multitenancy=true
        ): ObjectEntity {
            return new ObjectEntity();
        }//end updateObject()
    }//end class
}//end if
