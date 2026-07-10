<?php

/**
 * Test stub for OCA\OpenRegister\Db\ObjectEntity.
 *
 * Mirrors the minimal ObjectEntity surface (getObject / setObject) that
 * OrderController consumes. Used only in environments where the openregister
 * runtime is not installed (e.g. bare CI containers). Loaded by
 * tests/bootstrap-unit.php when the real class is absent, and replaced by the
 * real class as soon as the openregister app is installed. NOT scanned by PHPCS.
 *
 * @category Test
 * @package  OCA\PetStore\Tests\Stubs\Db
 *
 * @author    Conduction Development Team <info@conduction.nl>
 * @copyright 2026 Conduction B.V.
 * @license   EUPL-1.2 https://joinup.ec.europa.eu/collection/eupl/eupl-text-eupl-12
 */

declare(strict_types=1);

namespace OCA\OpenRegister\Db;

if (class_exists(ObjectEntity::class) === false) {
    /**
     * Stub ObjectEntity — used only in standalone unit tests.
     */
    class ObjectEntity
    {

        /**
         * The object data.
         *
         * @var array<string, mixed>
         */
        private array $object = [];

        /**
         * Get the object data.
         *
         * @return array<string, mixed>
         */
        public function getObject(): array
        {
            return $this->object;
        }//end getObject()

        /**
         * Set the object data.
         *
         * @param array<string, mixed> $object The object data.
         *
         * @return void
         */
        public function setObject(array $object): void
        {
            $this->object = $object;
        }//end setObject()
    }//end class
}//end if
