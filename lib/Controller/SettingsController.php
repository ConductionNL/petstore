<?php

/**
 * PetStore Settings Controller
 *
 * Controller for managing PetStore application settings.
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
 */

declare(strict_types=1);

namespace OCA\PetStore\Controller;

use OCA\PetStore\AppInfo\Application;
use OCA\PetStore\Service\SettingsService;
use OCP\AppFramework\Controller;
use OCP\AppFramework\Http\JSONResponse;
use OCP\IRequest;

/**
 * Controller for managing PetStore application settings.
 */
class SettingsController extends Controller
{
    /**
     * Constructor for the SettingsController.
     *
     * @param IRequest        $request         The request object
     * @param SettingsService $settingsService The settings service
     *
     * @return void
     */
    public function __construct(
        IRequest $request,
        private SettingsService $settingsService,
    ) {
        parent::__construct(appName: Application::APP_ID, request: $request);
    }//end __construct()

    /**
     * Retrieve all current settings.
     *
     * Admin-sensitive fields (register binding) are stripped for non-admin users
     * so the register UUID is not exposed to regular authenticated users.
     *
     * @NoAdminRequired
     *
     * @return JSONResponse
     *
     * @spec openspec/specs/settings-management/spec.md#REQ-CFG-001
     */
    public function index(): JSONResponse
    {
        $settings = $this->settingsService->getSettings();
        $isAdmin  = ($settings['isAdmin'] ?? false);

        if ($isAdmin === false) {
            unset($settings['register']);
        }

        return new JSONResponse($settings);
    }//end index()

    /**
     * Update settings with provided data.
     *
     * Admin-only, and deliberately so: this rewrites the app-wide register and
     * schema binding, which is what every object read and write in PetStore
     * resolves through. It is NOT annotated @NoAdminRequired — in Nextcloud the
     * ABSENCE of that tag IS the admin gate, so the posture was already
     * correct. What was missing is the DECLARATION: an endpoint that is
     * admin-only on purpose and one whose author forgot the attribute look
     * identical in the source, which is exactly what gate-5 exists to catch.
     * The tag below states the intent without changing the enforcement.
     *
     * @auth admin-only Rewrites the app-wide register/schema binding that every PetStore object read and write resolves through.
     *
     * @return JSONResponse
     *
     * @spec openspec/specs/settings-management/spec.md#REQ-CFG-002
     */
    public function create(): JSONResponse
    {
        $data   = $this->request->getParams();
        $config = $this->settingsService->updateSettings($data);

        return new JSONResponse(
            [
                'success' => true,
                'config'  => $config,
            ]
        );
    }//end create()

    /**
     * Re-import the configuration from app_template_register.json.
     *
     * Forces a fresh import regardless of version, auto-configuring
     * all schema and register IDs from the import result.
     *
     * Admin-only, and deliberately so: a re-import discards the current
     * register/schema binding and replaces it wholesale. Same reasoning as
     * create() above — the posture came from the absence of @NoAdminRequired
     * and was already correct; only the declaration was missing.
     *
     * @auth admin-only Forces a full configuration re-import, replacing the register and schema binding wholesale.
     *
     * @return JSONResponse
     *
     * @spec openspec/specs/settings-management/spec.md#REQ-CFG-003
     */
    public function load(): JSONResponse
    {
        $result = $this->settingsService->reloadConfiguration();

        return new JSONResponse($result);
    }//end load()
}//end class
