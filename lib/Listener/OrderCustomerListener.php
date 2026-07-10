<?php

/**
 * PetStore OrderCustomerListener
 *
 * Stamps the `customer` field on a new `order` object with the UID of the
 * signed-in user, server-side, at creation time. Listens to OpenRegister's
 * vetoable pre-write ObjectCreatingEvent (fired from OR's central write path,
 * so it covers the SPA / REST / GraphQL create routes uniformly) and scopes
 * itself strictly to the petstore/order register+schema.
 *
 * ADR-005 note: `customer` is DISPLAY DATA, not an authorization boundary.
 * The value is derived from IUserSession (never trusted from the request
 * body), and nothing in the app makes an access decision based on it — the
 * real per-object-owner pattern lives in OpenRegister's `@self.owner`
 * (see openspec/specs/item-management/spec.md).
 *
 * This listener MUST NEVER throw: it runs on a shared, instance-wide event,
 * and an exception here would break object creation for every app. Every
 * failure path is swallowed and the create proceeds unchanged.
 *
 * @category Listener
 * @package  OCA\PetStore\Listener
 *
 * @author    Conduction Development Team <info@conduction.nl>
 * @copyright 2026 Conduction B.V.
 * @license   EUPL-1.2 https://joinup.ec.europa.eu/collection/eupl/eupl-text-eupl-12
 *
 * SPDX-FileCopyrightText: 2026 Conduction B.V. <info@conduction.nl>
 * SPDX-License-Identifier: EUPL-1.2
 *
 * @version GIT: <git-id>
 *
 * @link https://conduction.nl
 *
 * @spec openspec/changes/add-order-customer-reference/specs/pet-catalog-domain/spec.md
 */

declare(strict_types=1);

namespace OCA\PetStore\Listener;

use OCP\EventDispatcher\Event;
use OCP\EventDispatcher\IEventListener;
use OCP\IUserSession;
use Psr\Container\ContainerInterface;
use Psr\Log\LoggerInterface;

/**
 * Stamps `order.customer` from the session on create, scoped to petstore/order.
 *
 * @template-implements IEventListener<Event>
 *
 * @psalm-suppress UndefinedClass OpenRegister event/mapper classes are an optional dependency.
 *
 * @spec openspec/changes/add-order-customer-reference/specs/pet-catalog-domain/spec.md
 */
class OrderCustomerListener implements IEventListener
{
    /**
     * The register slug that owns the order schema.
     *
     * @var string
     */
    private const REGISTER_SLUG = 'petstore';

    /**
     * The schema slug this listener acts on.
     *
     * @var string
     */
    private const SCHEMA_SLUG = 'order';

    /**
     * Constructor.
     *
     * @param IUserSession       $userSession The current user session (customer source).
     * @param ContainerInterface $container   Service locator for OpenRegister mappers.
     * @param LoggerInterface    $logger      The logger.
     *
     * @psalm-suppress PossiblyUnusedMethod Instantiated via Nextcloud dependency injection.
     */
    public function __construct(
        private readonly IUserSession $userSession,
        private readonly ContainerInterface $container,
        private readonly LoggerInterface $logger,
    ) {
    }//end __construct()

    /**
     * Handle an OpenRegister pre-create event; stamp customer for petstore/order.
     *
     * @param Event $event The dispatched event.
     *
     * @return void
     *
     * @psalm-suppress MixedMethodCall  OpenRegister event/entity/mapper classes are optional dependencies.
     * @psalm-suppress MixedAssignment  OpenRegister event/entity/mapper classes are optional dependencies.
     * @psalm-suppress MixedArrayAccess OpenRegister returns loosely-typed object data.
     *
     * @SuppressWarnings(PHPMD.CyclomaticComplexity)
     * @SuppressWarnings(PHPMD.NPathComplexity)
     *
     * @spec openspec/changes/add-order-customer-reference/specs/pet-catalog-domain/spec.md
     */
    public function handle(Event $event): void
    {
        if (($event instanceof \OCA\OpenRegister\Event\ObjectCreatingEvent) === false) {
            return;
        }

        try {
            // @phpstan-ignore-next-line  Optional OpenRegister dependency.
            $entity = $event->getObject();
            if ($entity === null || $this->isPetstoreOrder(entity: $entity) === false) {
                return;
            }

            $user = $this->userSession->getUser();
            if ($user === null) {
                return;
            }

            $data = $entity->getObject();

            // Do not override a customer already present on the incoming object
            // (e.g. an admin import that intentionally set one).
            $existing = ($data['customer'] ?? '');
            if (is_string($existing) === true && $existing !== '') {
                return;
            }

            // OR merges modifiedData into the entity before persisting.
            // @phpstan-ignore-next-line  Optional OpenRegister dependency.
            $event->setModifiedData(['customer' => $user->getUID()]);
        } catch (\Throwable $e) {
            // Never break object creation — this is a best-effort convenience.
            $this->logger->debug(
                'PetStore: order customer stamping skipped',
                ['reason' => $e->getMessage()]
            );
        }//end try
    }//end handle()

    /**
     * True when the entity is a petstore/order object.
     *
     * Resolves the entity's register+schema ids to their slugs via
     * OpenRegister's mappers (request-cached) and matches both — so a
     * same-named `order` schema in another register does not match.
     *
     * @param object $entity The OpenRegister ObjectEntity being created.
     *
     * @return bool
     *
     * @psalm-suppress MixedMethodCall OpenRegister mapper/entity classes are optional dependencies.
     * @psalm-suppress MixedArgument   OpenRegister mapper/entity classes are optional dependencies.
     */
    private function isPetstoreOrder(object $entity): bool
    {
        if (method_exists($entity, 'getSchema') === false
            || method_exists($entity, 'getRegister') === false
        ) {
            return false;
        }

        $schemaId   = (string) $entity->getSchema();
        $registerId = (string) $entity->getRegister();
        if ($schemaId === '' || $registerId === '') {
            return false;
        }

        $schemaMapper   = $this->container->get('OCA\OpenRegister\Db\SchemaMapper');
        $registerMapper = $this->container->get('OCA\OpenRegister\Db\RegisterMapper');

        $schemaSlug   = (string) $schemaMapper->find($schemaId)->getSlug();
        $registerSlug = (string) $registerMapper->find($registerId)->getSlug();

        return ($schemaSlug === self::SCHEMA_SLUG && $registerSlug === self::REGISTER_SLUG);
    }//end isPetstoreOrder()
}//end class
