<?php

/**
 * Wire contract of the per-user preferences endpoints.
 *
 * @category Test
 * @package  OCA\PetStore\Tests\Unit\Controller
 *
 * @author    Conduction Development Team <info@conduction.nl>
 * @copyright 2026 Conduction B.V.
 * @license   EUPL-1.2 https://joinup.ec.europa.eu/collection/eupl/eupl-text-eupl-12
 *
 * @link https://conduction.nl
 *
 * SPDX-FileCopyrightText: 2026 Conduction B.V. <info@conduction.nl>
 * SPDX-License-Identifier: EUPL-1.2
 *
 * @spec openspec/specs/settings-management/spec.md#REQ-CFG-005
 * @spec openspec/specs/settings-management/spec.md#REQ-CFG-006
 */

declare(strict_types=1);

namespace OCA\PetStore\Tests\Unit\Controller;

use OCA\PetStore\Controller\PreferencesController;
use OCP\AppFramework\Http;
use OCP\IConfig;
use OCP\IRequest;
use OCP\IUser;
use OCP\IUserSession;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;

/**
 * `GET /api/preferences/{key}` and `PUT /api/preferences/{key}` are the only
 * two endpoints in this app that a SHARED library calls (the
 * `@conduction/nextcloud-vue` widgets), so their wire shape is a contract with
 * code that does not live here. This suite pins that shape: the status codes,
 * the `{ "value": … }` envelope, the `pref_` namespace the key is confined to,
 * and the clear-vs-store branch.
 *
 * @spec openspec/specs/settings-management/spec.md#REQ-CFG-005
 * @spec openspec/specs/settings-management/spec.md#REQ-CFG-006
 */
class PreferencesControllerTest extends TestCase
{
    /**
     * The signed-in user's id used throughout.
     */
    private const UID = 'alice';

    /**
     * The controller under test.
     *
     * @var PreferencesController
     */
    private PreferencesController $controller;

    /**
     * Config double — also the assertion surface for the `pref_` namespace.
     *
     * @var IConfig&MockObject
     */
    private IConfig&MockObject $config;

    /**
     * Session double.
     *
     * @var IUserSession&MockObject
     */
    private IUserSession&MockObject $userSession;

    /**
     * Build the controller with a signed-in user by default.
     *
     * @return void
     */
    protected function setUp(): void
    {
        parent::setUp();

        $this->config      = $this->createMock(IConfig::class);
        $this->userSession = $this->createMock(IUserSession::class);

        $user = $this->createMock(IUser::class);
        $user->method('getUID')->willReturn(self::UID);
        $this->userSession->method('getUser')->willReturn($user);

        $this->controller = new PreferencesController(
            $this->createMock(IRequest::class),
            $this->config,
            $this->userSession
        );

    }//end setUp()

    /**
     * A stored value comes back under `value`, read from the `pref_` namespace.
     *
     * @return void
     *
     * @spec openspec/specs/settings-management/spec.md#REQ-CFG-005
     */
    public function testGetPreferenceReturnsTheStoredValue(): void
    {
        $this->config->expects($this->once())
            ->method('getUserValue')
            ->with(self::UID, 'petstore', 'pref_seen-hint', '')
            ->willReturn('yes');

        $response = $this->controller->getPreference('seen-hint');

        $this->assertSame(Http::STATUS_OK, $response->getStatus());
        $this->assertSame(['value' => 'yes'], $response->getData());

    }//end testGetPreferenceReturnsTheStoredValue()

    /**
     * An unset key reads back as null, NOT as an empty string and NOT as an
     * error — the widgets distinguish "never set" from "set to nothing" only
     * by this, and REQ-CFG-006 requires a cleared key to read identically.
     *
     * @return void
     *
     * @spec openspec/specs/settings-management/spec.md#REQ-CFG-005
     */
    public function testGetPreferenceReturnsNullForAnUnsetKey(): void
    {
        $this->config->method('getUserValue')->willReturn('');

        $response = $this->controller->getPreference('never-set');

        $this->assertSame(Http::STATUS_OK, $response->getStatus());
        $this->assertSame(['value' => null], $response->getData());

    }//end testGetPreferenceReturnsNullForAnUnsetKey()

    /**
     * A key that sanitises to nothing is a 400, and NO config read happens —
     * the sanitiser is what stops a caller addressing another app's or another
     * scope's user values.
     *
     * @return void
     *
     * @spec openspec/specs/settings-management/spec.md#REQ-CFG-005
     */
    public function testGetPreferenceRejectsAKeyThatSanitisesToNothing(): void
    {
        $this->config->expects($this->never())->method('getUserValue');

        $response = $this->controller->getPreference('///');

        $this->assertSame(Http::STATUS_BAD_REQUEST, $response->getStatus());

    }//end testGetPreferenceRejectsAKeyThatSanitisesToNothing()

    /**
     * Anonymous callers get 401 and nothing is read.
     *
     * @return void
     *
     * @spec openspec/specs/settings-management/spec.md#REQ-CFG-005
     */
    public function testGetPreferenceRejectsAnAnonymousCaller(): void
    {
        $controller = new PreferencesController(
            $this->createMock(IRequest::class),
            $this->config,
            $this->createMock(IUserSession::class)
        );

        $this->config->expects($this->never())->method('getUserValue');

        $response = $controller->getPreference('seen-hint');

        $this->assertSame(Http::STATUS_UNAUTHORIZED, $response->getStatus());

    }//end testGetPreferenceRejectsAnAnonymousCaller()

    /**
     * A non-empty write persists against this user and this app only, and the
     * response echoes the stored value.
     *
     * @return void
     *
     * @spec openspec/specs/settings-management/spec.md#REQ-CFG-006
     */
    public function testSetPreferenceStoresTheValue(): void
    {
        $this->config->expects($this->once())
            ->method('setUserValue')
            ->with(self::UID, 'petstore', 'pref_seen-hint', 'yes');
        $this->config->expects($this->never())->method('deleteUserValue');

        $response = $this->controller->setPreference('seen-hint', 'yes');

        $this->assertSame(Http::STATUS_OK, $response->getStatus());
        $this->assertSame(['value' => 'yes'], $response->getData());

    }//end testSetPreferenceStoresTheValue()

    /**
     * An EMPTY value DELETES rather than storing an empty string, so a cleared
     * preference and a never-set one read back identically (REQ-CFG-006). A
     * `setUserValue(…, '')` here would be invisible to every later read.
     *
     * @return void
     *
     * @spec openspec/specs/settings-management/spec.md#REQ-CFG-006
     */
    public function testSetPreferenceWithAnEmptyValueClearsIt(): void
    {
        $this->config->expects($this->once())
            ->method('deleteUserValue')
            ->with(self::UID, 'petstore', 'pref_seen-hint');
        $this->config->expects($this->never())->method('setUserValue');

        $response = $this->controller->setPreference('seen-hint', '');

        $this->assertSame(Http::STATUS_OK, $response->getStatus());
        $this->assertSame(['value' => null], $response->getData());

    }//end testSetPreferenceWithAnEmptyValueClearsIt()

    /**
     * The key is lower-cased and stripped to `[a-z0-9-]` before it reaches
     * IConfig, so `../` and friends cannot escape the `pref_` namespace.
     *
     * @return void
     *
     * @spec openspec/specs/settings-management/spec.md#REQ-CFG-006
     */
    public function testSetPreferenceSanitisesTheKeyBeforeWriting(): void
    {
        $this->config->expects($this->once())
            ->method('setUserValue')
            ->with(self::UID, 'petstore', 'pref_configlastlogin', 'x');

        $response = $this->controller->setPreference('../config/Last_Login!', 'x');

        $this->assertSame(Http::STATUS_OK, $response->getStatus());

    }//end testSetPreferenceSanitisesTheKeyBeforeWriting()

    /**
     * Anonymous callers get 401 and nothing is written.
     *
     * @return void
     *
     * @spec openspec/specs/settings-management/spec.md#REQ-CFG-006
     */
    public function testSetPreferenceRejectsAnAnonymousCaller(): void
    {
        $controller = new PreferencesController(
            $this->createMock(IRequest::class),
            $this->config,
            $this->createMock(IUserSession::class)
        );

        $this->config->expects($this->never())->method('setUserValue');
        $this->config->expects($this->never())->method('deleteUserValue');

        $response = $controller->setPreference('seen-hint', 'yes');

        $this->assertSame(Http::STATUS_UNAUTHORIZED, $response->getStatus());

    }//end testSetPreferenceRejectsAnAnonymousCaller()
}//end class
