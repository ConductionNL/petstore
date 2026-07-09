<?php

/**
 * PetStore Portal Action Controller (fleet reference implementation)
 *
 * The fleet's REFERENCE example of a guarded ADR-046 contract-v2 A6 endpoint —
 * the receiving end of portaliq's server-to-server action forward. The route
 * is `#[PublicPage]` + `#[NoCSRFRequired]` because the caller is portaliq's
 * backend, not a browser: the `X-Portal-Subject` assertion IS the
 * authentication, verified by PortalAssertionVerifier before anything else
 * happens. There is deliberately NO Nextcloud-session fallback — a logged-in
 * admin without a valid assertion gets the same 401 as anyone else, so there
 * is exactly one auth path and no confused-deputy ambiguity.
 *
 * Fail-closed ordering every A6 receiver copies:
 *   verify (401) → derive scope from claims → validate input (400) →
 *   authorize against the domain row (403) → act → relay (200/503).
 *
 * All subject identity comes from the VERIFIED claims (`sub` = the owner
 * contact UUID, consistent with the contribution's `scopeField: owner`);
 * request parameters only ever choose the target and the effect, never the
 * subject (ADR-005).
 *
 * @category Controller
 * @package  OCA\PetStore\Controller
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
 * @spec openspec/changes/portal-assertion-verifier/tasks.md#task-3
 */

declare(strict_types=1);

namespace OCA\PetStore\Controller;

use OCA\PetStore\AppInfo\Application;
use OCA\PetStore\Portal\PortalAssertionVerifier;
use OCP\AppFramework\Controller;
use OCP\AppFramework\Http;
use OCP\AppFramework\Http\Attribute\NoCSRFRequired;
use OCP\AppFramework\Http\Attribute\PublicPage;
use OCP\AppFramework\Http\JSONResponse;
use OCP\IRequest;
use Psr\Container\ContainerInterface;
use Psr\Log\LoggerInterface;
use Throwable;

/**
 * Receives portaliq's forwarded portal actions on the pet schema.
 *
 * @spec openspec/changes/portal-assertion-verifier/tasks.md#task-3
 */
class PortalActionController extends Controller
{
    /**
     * OpenRegister's object service, resolved lazily by FQCN so petstore
     * keeps zero compile-time OpenRegister coupling (same pattern as
     * SettingsService and portaliq's reader/writer).
     */
    private const OBJECT_SERVICE = 'OCA\\OpenRegister\\Service\\ObjectService';

    /**
     * The register the demo action operates on.
     */
    private const REGISTER = 'petstore';

    /**
     * The schema the demo action operates on.
     */
    private const SCHEMA_PET = 'pet';

    /**
     * Constructor.
     *
     * @param IRequest                $request   The request object.
     * @param PortalAssertionVerifier $verifier  Verifies the X-Portal-Subject assertion.
     * @param ContainerInterface      $container For resolving OpenRegister services lazily.
     * @param LoggerInterface         $logger    The logger.
     */
    public function __construct(
        IRequest $request,
        private readonly PortalAssertionVerifier $verifier,
        private readonly ContainerInterface $container,
        private readonly LoggerInterface $logger,
    ) {
        parent::__construct(appName: Application::APP_ID, request: $request);
    }//end __construct()

    /**
     * Rename a pet the asserted portal subject owns (demo A6 action).
     *
     * Declared in PortalContributionProvider as endpoint action `renamePet`;
     * portaliq forwards `POST /apps/petstore/api/portal/pets/rename` with the
     * portal client's JSON body `{"pet": "<uuid>", "name": "<new name>"}` and
     * the signed assertion header. The domain effect is deliberately trivial
     * but REAL and subject-scoped: the pet's `owner` must equal the verified
     * `sub` claim, and only the `name` field is written.
     *
     * Response contract: 200 `{id, name}` on success; 401 missing/invalid
     * assertion; 400 unusable `pet`/`name`; 403 pet absent OR not owned
     * (identical — no existence oracle); 503 OpenRegister unavailable.
     *
     * @return JSONResponse
     *
     * @spec openspec/changes/portal-assertion-verifier/tasks.md#task-3
     *
     * @SuppressWarnings(PHPMD.CyclomaticComplexity) -- one fail-closed guard
     * per response class (401/400/403/503) on an auth boundary (ADR-005);
     * collapsing them would trade auditability for a score.
     */
    #[PublicPage]
    #[NoCSRFRequired]
    public function renameOwnedPet(): JSONResponse
    {
        // 1. Verify — the assertion is the ONLY credential (fail-closed 401).
        $claims = $this->verifier->verify((string) $this->request->getHeader(PortalAssertionVerifier::HEADER));
        if ($claims === null) {
            return new JSONResponse(['error' => 'unauthorized'], Http::STATUS_UNAUTHORIZED);
        }

        // 2. Derive ALL scope from the verified claims — never from params.
        // The verifier guarantees `sub` is a non-empty string.
        $subjectRef = (string) $claims['sub'];

        // 3. Validate the client-chosen target + effect.
        $petId = $this->request->getParam('pet');
        $name  = $this->request->getParam('name');
        if (is_string($petId) === false || $petId === '' || is_string($name) === false || trim($name) === '') {
            return new JSONResponse(['error' => 'invalid_request'], Http::STATUS_BAD_REQUEST);
        }

        $name = trim($name);

        $objectService = $this->objectService();
        if ($objectService === null) {
            return new JSONResponse(['error' => 'openregister_unavailable'], Http::STATUS_SERVICE_UNAVAILABLE);
        }

        // 4. Authorize against the domain row: the pet must exist AND be
        // owned by the asserted subject. Both failures return the same
        // 403 so pet UUIDs cannot be enumerated (no existence oracle).
        $pet = $this->fetchPet(objectService: $objectService, petId: $petId);
        if ($pet === null || (string) ($pet['owner'] ?? '') !== $subjectRef) {
            return new JSONResponse(['error' => 'forbidden'], Http::STATUS_FORBIDDEN);
        }

        // 5. Act — write ONLY the name field back through OpenRegister.
        $saved = $this->renamePet(objectService: $objectService, pet: $pet, petId: $petId, name: $name);
        if ($saved === null) {
            return new JSONResponse(['error' => 'openregister_unavailable'], Http::STATUS_SERVICE_UNAVAILABLE);
        }

        return new JSONResponse(
            [
                'id'   => (string) ($saved['id'] ?? $petId),
                'name' => $name,
            ]
        );
    }//end renameOwnedPet()

    /**
     * Fetch the pet row via OpenRegister, or null when absent/unreadable.
     *
     * RBAC + multitenancy are OFF exactly as in portaliq's reader/writer:
     * portal subjects are not Nextcloud users, so OR's user-based scoping
     * would deny everything. The `owner === sub` check in the handler IS the
     * security boundary for this read (ADR-005).
     *
     * @param object $objectService OpenRegister's ObjectService.
     * @param string $petId         The pet id/uuid chosen by the client.
     *
     * @return array<string, mixed>|null
     *
     * @spec openspec/changes/portal-assertion-verifier/tasks.md#task-3
     */
    private function fetchPet(object $objectService, string $petId): ?array
    {
        try {
            $row = $objectService->find(
                id: $petId,
                register: self::REGISTER,
                schema: self::SCHEMA_PET,
                _rbac: false,
                _multitenancy: false
            );
        } catch (Throwable $e) {
            // Unknown id or read failure — both collapse into the same 403
            // upstream (fail-closed, no existence oracle). Debug log only.
            $this->logger->debug('PetStore: portal pet lookup failed', ['reason' => $e->getMessage()]);
            return null;
        }

        return $this->normalise(row: $row);
    }//end fetchPet()

    /**
     * Persist the rename: strip OR metadata keys (`@…`, `id`) from the
     * fetched row so the roundtrip cannot corrupt the object, set the new
     * name, and save back under the same uuid.
     *
     * @param object               $objectService OpenRegister's ObjectService.
     * @param array<string, mixed> $pet           The fetched (owner-verified) pet row.
     * @param string               $petId         The pet uuid to update.
     * @param string               $name          The new (trimmed, non-empty) name.
     *
     * @return array<string, mixed>|null The saved row, or null on write failure.
     *
     * @spec openspec/changes/portal-assertion-verifier/tasks.md#task-3
     */
    private function renamePet(object $objectService, array $pet, string $petId, string $name): ?array
    {
        $data = [];
        foreach ($pet as $key => $value) {
            if ($key === 'id' || str_starts_with((string) $key, '@') === true) {
                continue;
            }

            $data[$key] = $value;
        }

        $data['name'] = $name;

        try {
            $saved = $objectService->saveObject(
                object: $data,
                register: self::REGISTER,
                schema: self::SCHEMA_PET,
                uuid: $petId,
                _rbac: false,
                _multitenancy: false
            );
        } catch (Throwable $e) {
            $this->logger->warning('PetStore: portal pet rename failed', ['reason' => $e->getMessage()]);
            return null;
        }

        return $this->normalise(row: $saved);
    }//end renamePet()

    /**
     * Normalise an OpenRegister result (array or ObjectEntity) to an array.
     *
     * @param mixed $row The fetched/saved object.
     *
     * @return array<string, mixed>|null
     */
    private function normalise(mixed $row): ?array
    {
        if (is_array($row) === true) {
            return $row;
        }

        if (is_object($row) === true && method_exists($row, 'jsonSerialize') === true) {
            $data = $row->jsonSerialize();
            if (is_array($data) === true) {
                return $data;
            }
        }

        return null;
    }//end normalise()

    /**
     * Resolve OpenRegister's ObjectService, or null when unavailable.
     *
     * @return object|null
     */
    private function objectService(): ?object
    {
        try {
            $service = $this->container->get(self::OBJECT_SERVICE);
        } catch (Throwable $e) {
            $this->logger->debug('PetStore: OpenRegister unavailable for portal action', ['reason' => $e->getMessage()]);
            return null;
        }

        if (is_object($service) === true) {
            return $service;
        }

        return null;
    }//end objectService()
}//end class
