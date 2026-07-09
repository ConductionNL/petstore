<?php

/**
 * Unit tests for PortalContributionProvider.
 *
 * Pins the fleet-reference ADR-046 contribution contract: the dual v2/v1
 * audience declaration, the fail-closed null for non-client subjects, and the
 * exact declarative manifest shape (owner-scoped collections + the strict
 * create-order field whitelist). The provider is constructed directly — it is
 * a plain dependency-free class by contract (amendment A1), so no mocks and
 * no container are involved.
 *
 * @category Test
 * @package  OCA\PetStore\Tests\Unit\Portal
 *
 * @author    Conduction Development Team <info@conduction.nl>
 * @copyright 2026 Conduction B.V.
 * @license   EUPL-1.2 https://joinup.ec.europa.eu/collection/eupl/eupl-text-eupl-12
 *
 * @version GIT: <git-id>
 *
 * @link https://conduction.nl
 *
 * @spec openspec/changes/portal-contribution/tasks.md#task-4
 * @spec openspec/changes/portal-assertion-verifier/tasks.md#task-6
 */

declare(strict_types=1);

namespace OCA\PetStore\Tests\Unit\Portal;

use OCA\PetStore\Portal\PortalContributionProvider;
use PHPUnit\Framework\TestCase;

/**
 * Tests for PortalContributionProvider.
 *
 * @spec openspec/changes/portal-contribution/tasks.md#task-4
 */
class PortalContributionProviderTest extends TestCase
{

    /**
     * The provider under test.
     *
     * @var PortalContributionProvider
     */
    private PortalContributionProvider $provider;

    /**
     * A fully server-derived client subject, as portaliq's auth edge builds it.
     *
     * @var array<string, mixed>
     */
    private const CLIENT_SUBJECT = [
        'subjectRef'   => '00000000-0000-0000-0000-000000000000',
        'audience'     => 'client',
        'organisation' => '00000000-0000-0000-0000-000000000000',
        'trust'        => 'substantial',
    ];

    /**
     * Set up the provider — direct construction, no dependencies by contract.
     *
     * @return void
     */
    protected function setUp(): void
    {
        parent::setUp();
        $this->provider = new PortalContributionProvider();

    }//end setUp()

    /**
     * The class is plain: no interfaces, no parent, no constructor deps.
     *
     * @return void
     */
    public function testClassIsPlainAndDependencyFree(): void
    {
        $reflection = new \ReflectionClass(PortalContributionProvider::class);

        $this->assertSame([], $reflection->getInterfaceNames());
        $this->assertFalse($reflection->getParentClass());
        $this->assertNull($reflection->getConstructor());

    }//end testClassIsPlainAndDependencyFree()

    /**
     * getAudiences() (v2) returns exactly ['client'].
     *
     * @return void
     */
    public function testGetAudiencesReturnsClient(): void
    {
        $this->assertSame(['client'], $this->provider->getAudiences());

    }//end testGetAudiencesReturnsClient()

    /**
     * getAudience() (v1 fallback) agrees with the v2 declaration.
     *
     * @return void
     */
    public function testGetAudienceReturnsClient(): void
    {
        $this->assertSame('client', $this->provider->getAudience());
        $this->assertContains($this->provider->getAudience(), $this->provider->getAudiences());

    }//end testGetAudienceReturnsClient()

    /**
     * Non-client subjects get null — fail-closed audience filtering.
     *
     * @return void
     */
    public function testGetContributionReturnsNullForNonClientSubjects(): void
    {
        $supplierSubject             = self::CLIENT_SUBJECT;
        $supplierSubject['audience'] = 'supplier';

        $this->assertNull($this->provider->getContribution($supplierSubject));
        $this->assertNull($this->provider->getContribution([]));

    }//end testGetContributionReturnsNullForNonClientSubjects()

    /**
     * A client subject receives the labelled manifest with all four sections.
     *
     * @return void
     */
    public function testGetContributionReturnsManifestForClientSubject(): void
    {
        $manifest = $this->provider->getContribution(self::CLIENT_SUBJECT);

        $this->assertIsArray($manifest);
        $this->assertSame('Pet Store', $manifest['label']);
        $this->assertArrayHasKey('collections', $manifest);
        $this->assertArrayHasKey('actions', $manifest);
        $this->assertSame([], $manifest['notifications']);

    }//end testGetContributionReturnsManifestForClientSubject()

    /**
     * Both collections are owner-scoped petstore register reads (A4).
     *
     * @return void
     */
    public function testCollectionsAreOwnerScoped(): void
    {
        $manifest    = $this->provider->getContribution(self::CLIENT_SUBJECT);
        $collections = $manifest['collections'];

        $this->assertCount(2, $collections);
        $this->assertSame(
            ['petCollection', 'orderCollection'],
            array_column($collections, 'id')
        );
        $this->assertSame(
            ['pet', 'order'],
            array_column($collections, 'schema')
        );

        foreach ($collections as $collection) {
            $this->assertSame('petstore', $collection['register']);
            $this->assertSame('owner', $collection['scopeField']);
            $this->assertTrue($collection['listable']);
            $this->assertNotEmpty($collection['label']);
        }

    }//end testCollectionsAreOwnerScoped()

    /**
     * createOrder is the first action and whitelists exactly pet, quantity, shipDate.
     *
     * @return void
     */
    public function testCreateOrderActionWhitelistsFields(): void
    {
        $manifest = $this->provider->getContribution(self::CLIENT_SUBJECT);
        $actions  = $manifest['actions'];

        $this->assertCount(2, $actions);

        $action = $actions[0];
        $this->assertSame('createOrder', $action['id']);
        $this->assertSame('create', $action['type']);
        $this->assertSame('petstore', $action['register']);
        $this->assertSame('order', $action['schema']);
        $this->assertNotEmpty($action['label']);
        $this->assertSame(['pet', 'quantity', 'shipDate'], $action['fields']);

    }//end testCreateOrderActionWhitelistsFields()

    /**
     * renamePet is declared as a contract-v2 A6 endpoint action: an
     * instance-local absolute path + POST, no `type` key (only create-actions
     * carry one), and an SSRF-safe endpoint declaration.
     *
     * @return void
     *
     * @spec openspec/changes/portal-assertion-verifier/tasks.md#task-6
     */
    public function testRenamePetEndpointActionIsDeclared(): void
    {
        $manifest = $this->provider->getContribution(self::CLIENT_SUBJECT);
        $action   = $manifest['actions'][1];

        $this->assertSame('renamePet', $action['id']);
        $this->assertNotEmpty($action['label']);
        $this->assertSame('/apps/petstore/api/portal/pets/rename', $action['endpoint']);
        $this->assertSame('POST', $action['method']);
        $this->assertArrayNotHasKey('type', $action);

        // Portaliq's SSRF guard: instance-local absolute path only.
        $this->assertStringStartsWith('/', $action['endpoint']);
        $this->assertStringNotContainsString('://', $action['endpoint']);
        $this->assertFalse(str_starts_with($action['endpoint'], '//'));

    }//end testRenamePetEndpointActionIsDeclared()
}//end class
