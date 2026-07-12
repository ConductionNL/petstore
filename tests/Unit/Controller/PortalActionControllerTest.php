<?php

/**
 * Unit tests for PortalActionController.
 *
 * Pins the fleet-reference A6 receiver endpoint contract: fail-closed
 * ordering (verify -> derive -> validate -> authorize -> act), the
 * 200/401/400/403/503 response matrix, that subject scope comes ONLY from
 * the verified assertion claims, and that the write touches ONLY the pet's
 * name (metadata stripped, owner untouched). Uses a REAL
 * PortalAssertionVerifier (plain-secret construction) with tokens minted the
 * portaliq way, a mocked ContainerInterface, and a duck-typed ObjectService
 * stub whose method signatures mirror OpenRegister's (named arguments must
 * resolve) — no Nextcloud server required.
 *
 * @category Test
 * @package  OCA\PetStore\Tests\Unit\Controller
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
 * @spec openspec/changes/portal-assertion-verifier/tasks.md#task-6
 */

declare(strict_types=1);

namespace OCA\PetStore\Tests\Unit\Controller;

use OCA\PetStore\Controller\PortalActionController;
use OCA\PetStore\Portal\PortalAssertionVerifier;
use OCP\AppFramework\Http;
use OCP\AppFramework\Http\JSONResponse;
use OCP\IRequest;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;
use Psr\Container\ContainerInterface;
use Psr\Log\LoggerInterface;

/**
 * Duck-typed ObjectService stub. Parameter names MUST mirror OpenRegister's
 * ObjectService (the controller calls with named arguments).
 *
 * @SuppressWarnings(PHPMD.CamelCaseParameterName) -- _rbac/_multitenancy mirror OR's API.
 */
class ObjectServiceStub
{

    /**
     * Rows by id, as ObjectService::find() would render them.
     *
     * @var array<string, array<string, mixed>>
     */
    public array $pets = [];

    /**
     * Captured saveObject() payload.
     *
     * @var array<string, mixed>|null
     */
    public ?array $savedData = null;

    /**
     * Captured saveObject() uuid.
     *
     * @var string|null
     */
    public ?string $savedUuid = null;

    /**
     * Make find() throw, as OR does for unknown ids.
     *
     * @var bool
     */
    public bool $throwOnFind = false;

    /**
     * Mirror of ObjectService::find().
     *
     * @param int|string $id            The object id/uuid.
     * @param array|null $_extend       Unused.
     * @param bool       $files         Unused.
     * @param mixed      $register      The register slug.
     * @param mixed      $schema        The schema slug.
     * @param bool       $_rbac         RBAC toggle.
     * @param bool       $_multitenancy Multitenancy toggle.
     *
     * @return array<string, mixed>|null
     */
    public function find(
        int | string $id,
        ?array $_extend=[],
        bool $files=false,
        mixed $register=null,
        mixed $schema=null,
        bool $_rbac=true,
        bool $_multitenancy=true
    ): ?array {
        if ($this->throwOnFind === true) {
            throw new \RuntimeException('Object not found');
        }

        return ($this->pets[(string) $id] ?? null);

    }//end find()

    /**
     * Mirror of ObjectService::saveObject().
     *
     * @param array|object $object        The object data.
     * @param array|null   $extend        Unused.
     * @param mixed        $register      The register slug.
     * @param mixed        $schema        The schema slug.
     * @param string|null  $uuid          The uuid to update.
     * @param bool         $_rbac         RBAC toggle.
     * @param bool         $_multitenancy Multitenancy toggle.
     *
     * @return array<string, mixed>
     */
    public function saveObject(
        array | object $object,
        ?array $extend=[],
        mixed $register=null,
        mixed $schema=null,
        ?string $uuid=null,
        bool $_rbac=true,
        bool $_multitenancy=true
    ): array {
        $this->savedData = (array) $object;
        $this->savedUuid = $uuid;

        return array_merge((array) $object, ['id' => (string) $uuid]);

    }//end saveObject()
}//end class

/**
 * Tests for PortalActionController.
 *
 * @spec openspec/changes/portal-assertion-verifier/tasks.md#task-6
 */
class PortalActionControllerTest extends TestCase
{

    /**
     * Signing secret shared by mint + verifier (>= 16 chars).
     */
    private const SECRET = 'petstore-test-secret-0123456789';

    /**
     * The asserted subject — the owner-contact UUID.
     */
    private const SUBJECT = '00000000-0000-0000-0000-000000000000';

    /**
     * The target pet uuid.
     */
    private const PET_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

    /**
     * Mock request.
     *
     * @var IRequest&MockObject
     */
    private IRequest&MockObject $request;

    /**
     * Mock container resolving the ObjectService stub.
     *
     * @var ContainerInterface&MockObject
     */
    private ContainerInterface&MockObject $container;

    /**
     * The duck-typed ObjectService stub.
     *
     * @var ObjectServiceStub
     */
    private ObjectServiceStub $objectService;

    /**
     * The controller under test.
     *
     * @var PortalActionController
     */
    private PortalActionController $controller;

    /**
     * Set up: real verifier (plain secret), stubbed OR, mocked request.
     *
     * @return void
     */
    protected function setUp(): void
    {
        parent::setUp();

        $this->request       = $this->createMock(IRequest::class);
        $this->container     = $this->createMock(ContainerInterface::class);
        $this->objectService = new ObjectServiceStub();

        $this->objectService->pets[self::PET_ID] = [
            'id'     => self::PET_ID,
            '@self'  => ['register' => 'petstore', 'schema' => 'pet'],
            'name'   => 'Rex',
            'status' => 'sold',
            'owner'  => self::SUBJECT,
        ];

        $this->container->method('get')
            ->with('OCA\\OpenRegister\\Service\\ObjectService')
            ->willReturn($this->objectService);

        $this->controller = new PortalActionController(
            request: $this->request,
            verifier: new PortalAssertionVerifier(config: null, secretOverride: self::SECRET),
            container: $this->container,
            logger: $this->createMock(LoggerInterface::class),
        );

    }//end setUp()

    /**
     * Mint an assertion exactly the way portaliq does (see verifier test).
     *
     * @param string $secret    The HMAC signing secret.
     * @param array  $overrides Claim overrides (null removes a claim).
     *
     * @return string Compact JWT.
     */
    private function mintAssertion(string $secret, array $overrides=[]): string
    {
        $iat    = time();
        $claims = [
            'sub'          => self::SUBJECT,
            'audience'     => 'client',
            'organisation' => '11111111-1111-1111-1111-111111111111',
            'trust'        => 'substantial',
            'jti'          => 'sessionjti0000000000000000000000',
            'use'          => 'assertion',
            'iat'          => $iat,
            'exp'          => ($iat + 60),
            'iss'          => 'portaliq',
        ];

        foreach ($overrides as $claim => $value) {
            if ($value === null) {
                unset($claims[$claim]);
                continue;
            }

            $claims[$claim] = $value;
        }

        $b64    = fn (string $bytes): string => rtrim(strtr(base64_encode($bytes), '+/', '-_'), '=');
        $hPart  = $b64((string) json_encode(['alg' => 'HS256', 'typ' => 'JWT'], JSON_UNESCAPED_SLASHES));
        $cPart  = $b64((string) json_encode($claims, JSON_UNESCAPED_SLASHES));

        return $hPart.'.'.$cPart.'.'.$b64(hash_hmac('sha256', $hPart.'.'.$cPart, $secret, true));

    }//end mintAssertion()

    /**
     * Wire the request mock with an assertion header + body params.
     *
     * @param string $header The X-Portal-Subject header value.
     * @param array  $params The request body params.
     *
     * @return void
     */
    private function wireRequest(string $header, array $params): void
    {
        $this->request->method('getHeader')
            ->with(PortalAssertionVerifier::HEADER)
            ->willReturn($header);
        $this->request->method('getParam')
            ->willReturnCallback(
                static function (string $key, mixed $default=null) use ($params): mixed {
                    return ($params[$key] ?? $default);
                }
            );

    }//end wireRequest()

    /**
     * Happy path: the owner renames their pet — 200, only `name` written.
     *
     * @return void
     */
    public function testRenameHappyPath(): void
    {
        $this->wireRequest(
            header: $this->mintAssertion(secret: self::SECRET),
            params: ['pet' => self::PET_ID, 'name' => '  Rexington  ']
        );

        $response = $this->controller->renameOwnedPet();

        self::assertInstanceOf(JSONResponse::class, $response);
        self::assertSame(Http::STATUS_OK, $response->getStatus());
        self::assertSame(['id' => self::PET_ID, 'name' => 'Rexington'], $response->getData());

        // The write went to the right row and touched ONLY the name...
        self::assertSame(self::PET_ID, $this->objectService->savedUuid);
        self::assertIsArray($this->objectService->savedData);
        self::assertSame('Rexington', $this->objectService->savedData['name']);
        self::assertSame('sold', $this->objectService->savedData['status']);
        // ...the server-managed owner scope is preserved, never client-writable...
        self::assertSame(self::SUBJECT, $this->objectService->savedData['owner']);
        // ...and OR metadata keys were stripped before the roundtrip.
        self::assertArrayNotHasKey('id', $this->objectService->savedData);
        self::assertArrayNotHasKey('@self', $this->objectService->savedData);

    }//end testRenameHappyPath()

    /**
     * Missing assertion header: 401 and OpenRegister is never touched.
     *
     * @return void
     */
    public function testMissingAssertionIs401(): void
    {
        $this->container->expects($this->never())->method('get');
        $this->wireRequest(header: '', params: ['pet' => self::PET_ID, 'name' => 'Rexington']);

        $response = $this->controller->renameOwnedPet();

        self::assertSame(Http::STATUS_UNAUTHORIZED, $response->getStatus());
        self::assertSame(['error' => 'unauthorized'], $response->getData());
        self::assertNull($this->objectService->savedData);

    }//end testMissingAssertionIs401()

    /**
     * Expired / forged assertions: same 401, no OpenRegister access.
     *
     * @return void
     */
    public function testInvalidAssertionIs401(): void
    {
        $this->container->expects($this->never())->method('get');
        $now = time();
        $this->wireRequest(
            header: $this->mintAssertion(secret: self::SECRET, overrides: ['iat' => ($now - 120), 'exp' => ($now - 60)]),
            params: ['pet' => self::PET_ID, 'name' => 'Rexington']
        );

        $response = $this->controller->renameOwnedPet();

        self::assertSame(Http::STATUS_UNAUTHORIZED, $response->getStatus());
        self::assertNull($this->objectService->savedData);

    }//end testInvalidAssertionIs401()

    /**
     * Unusable pet/name input: 400 before any authorization work.
     *
     * @return void
     */
    public function testBadInputIs400(): void
    {
        $this->wireRequest(header: $this->mintAssertion(secret: self::SECRET), params: ['pet' => self::PET_ID, 'name' => '   ']);

        $response = $this->controller->renameOwnedPet();

        self::assertSame(Http::STATUS_BAD_REQUEST, $response->getStatus());
        self::assertSame(['error' => 'invalid_request'], $response->getData());
        self::assertNull($this->objectService->savedData);

    }//end testBadInputIs400()

    /**
     * A valid assertion for a pet owned by SOMEONE ELSE: 403, nothing written.
     * Subject scope comes from the claims — the request cannot override it.
     *
     * @return void
     */
    public function testForeignPetIs403(): void
    {
        $this->objectService->pets[self::PET_ID]['owner'] = '99999999-9999-9999-9999-999999999999';
        $this->wireRequest(
            header: $this->mintAssertion(secret: self::SECRET),
            params: ['pet' => self::PET_ID, 'name' => 'Rexington']
        );

        $response = $this->controller->renameOwnedPet();

        self::assertSame(Http::STATUS_FORBIDDEN, $response->getStatus());
        self::assertSame(['error' => 'forbidden'], $response->getData());
        self::assertNull($this->objectService->savedData);

    }//end testForeignPetIs403()

    /**
     * Unknown pet: the SAME 403 as the foreign-owner case (no existence
     * oracle) — for both a null lookup and an OR find() throw.
     *
     * @return void
     */
    public function testUnknownPetIs403(): void
    {
        $this->wireRequest(
            header: $this->mintAssertion(secret: self::SECRET),
            params: ['pet' => 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'name' => 'Rexington']
        );

        $response = $this->controller->renameOwnedPet();
        self::assertSame(Http::STATUS_FORBIDDEN, $response->getStatus());
        self::assertSame(['error' => 'forbidden'], $response->getData());

        $this->objectService->throwOnFind = true;
        $thrown = $this->controller->renameOwnedPet();
        self::assertSame(Http::STATUS_FORBIDDEN, $thrown->getStatus());
        self::assertSame(['error' => 'forbidden'], $thrown->getData());
        self::assertNull($this->objectService->savedData);

    }//end testUnknownPetIs403()

    /**
     * OpenRegister unresolvable: 503 with a machine-readable key.
     *
     * @return void
     */
    public function testOpenRegisterUnavailableIs503(): void
    {
        $request   = $this->createMock(IRequest::class);
        $container = $this->createMock(ContainerInterface::class);
        $container->method('get')->willThrowException(new \RuntimeException('not installed'));

        $controller = new PortalActionController(
            request: $request,
            verifier: new PortalAssertionVerifier(config: null, secretOverride: self::SECRET),
            container: $container,
            logger: $this->createMock(LoggerInterface::class),
        );

        $request->method('getHeader')->willReturn($this->mintAssertion(secret: self::SECRET));
        $request->method('getParam')
            ->willReturnCallback(
                static function (string $key, mixed $default=null): mixed {
                    $params = ['pet' => self::PET_ID, 'name' => 'Rexington'];
                    return ($params[$key] ?? $default);
                }
            );

        $response = $controller->renameOwnedPet();

        self::assertSame(Http::STATUS_SERVICE_UNAVAILABLE, $response->getStatus());
        self::assertSame(['error' => 'openregister_unavailable'], $response->getData());

    }//end testOpenRegisterUnavailableIs503()
}//end class
