<?php

/**
 * PetStore Settings Service
 *
 * Service for managing PetStore application configuration and settings.
 *
 * @category Service
 * @package  OCA\PetStore\Service
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

namespace OCA\PetStore\Service;

use OCA\PetStore\AppInfo\Application;
use OCP\App\IAppManager;
use OCP\IAppConfig;
use OCP\IGroupManager;
use OCP\IUserSession;
use Psr\Container\ContainerInterface;
use Psr\Log\LoggerInterface;

/**
 * Service for managing PetStore application configuration and settings.
 */
class SettingsService
{

    /**
     * Configuration keys managed by this service.
     *
     * @var array<string>
     */
    private const CONFIG_KEYS = [
        'register',
    ];

    /**
     * Constructor for the SettingsService.
     *
     * @param IAppConfig         $appConfig    The app config interface
     * @param IAppManager        $appManager   The app manager
     * @param ContainerInterface $container    The container
     * @param IGroupManager      $groupManager The group manager
     * @param IUserSession       $userSession  The user session
     * @param LoggerInterface    $logger       The logger
     *
     * @return void
     */
    public function __construct(
        private IAppConfig $appConfig,
        private IAppManager $appManager,
        private ContainerInterface $container,
        private IGroupManager $groupManager,
        private IUserSession $userSession,
        private LoggerInterface $logger,
    ) {
    }//end __construct()

    /**
     * Check whether OpenRegister is installed and available.
     *
     * @return bool
     */
    public function isOpenRegisterAvailable(): bool
    {
        return $this->appManager->isInstalled('openregister');
    }//end isOpenRegisterAvailable()

    /**
     * Retrieve all current settings.
     *
     * Returns a flat array containing all app config values plus metadata
     * fields (openregisters, isAdmin) consumed by the frontend.
     *
     * @return array<string,mixed>
     *
     * @spec openspec/specs/settings-management/spec.md#REQ-CFG-001
     */
    public function getSettings(): array
    {
        $settings = [];
        foreach (self::CONFIG_KEYS as $key) {
            $settings[$key] = $this->appConfig->getValueString(Application::APP_ID, $key, '');
        }

        $user    = $this->userSession->getUser();
        $isAdmin = ($user !== null && $this->groupManager->isAdmin($user->getUID()));

        return array_merge(
            $settings,
            [
                'openregisters' => $this->isOpenRegisterAvailable(),
                'isAdmin'       => $isAdmin,
            ]
        );
    }//end getSettings()

    /**
     * Update settings with the provided data.
     *
     * @param array<string,mixed> $data The data to update
     *
     * @return array<string,mixed> The updated settings
     *
     * @spec openspec/specs/settings-management/spec.md#REQ-CFG-002
     */
    public function updateSettings(array $data): array
    {
        foreach (self::CONFIG_KEYS as $key) {
            if (isset($data[$key]) === true) {
                $this->appConfig->setValueString(Application::APP_ID, $key, (string) $data[$key]);
            }
        }

        return $this->getSettings();
    }//end updateSettings()

    /**
     * Import the shipped register configuration, skipping it when OpenRegister
     * already holds this version.
     *
     * This is the first-install path, driven by the repair step.
     *
     * @return array<string,mixed> Result with success flag, message, and version.
     *
     * @spec openspec/specs/settings-management/spec.md#REQ-CFG-003
     */
    public function initializeConfiguration(): array
    {
        return $this->importConfiguration(force: false);

    }//end initializeConfiguration()

    /**
     * Re-import the shipped register configuration, overwriting whatever
     * OpenRegister already holds.
     *
     * This is the admin "reload configuration" path.
     *
     * @return array<string,mixed> Result with success flag, message, and version.
     *
     * @spec openspec/specs/settings-management/spec.md#REQ-CFG-003
     */
    public function reloadConfiguration(): array
    {
        return $this->importConfiguration(force: true);

    }//end reloadConfiguration()

    /**
     * Read petstore_register.json and hand it to OpenRegister's importer.
     *
     * @param bool $force Whether OpenRegister should overwrite an existing import.
     *
     * @return array<string,mixed> Result with success flag, message, and version.
     *
     * @spec openspec/specs/settings-management/spec.md#REQ-CFG-003
     */
    private function importConfiguration(bool $force): array
    {
        if ($this->isOpenRegisterAvailable() === false) {
            $this->logger->warning('PetStore: OpenRegister not available, skipping register initialization');
            return [
                'success' => false,
                'message' => 'OpenRegister is not installed or enabled.',
            ];
        }

        try {
            // Load the register configuration shipped with the app.
            // OpenRegister's importFromApp() requires the parsed configuration
            // data and its version; calling it with only appId/force throws an
            // ArgumentCountError on every invocation ("configuration import failed").
            $configPath = __DIR__.'/../Settings/petstore_register.json';
            if (file_exists($configPath) === false) {
                return [
                    'success' => false,
                    'message' => 'Register configuration file not found: petstore_register.json',
                ];
            }

            $configContent = file_get_contents($configPath);
            if ($configContent === false) {
                return [
                    'success' => false,
                    'message' => 'Failed to read register configuration file.',
                ];
            }

            $configData = json_decode($configContent, true);
            if (json_last_error() !== JSON_ERROR_NONE) {
                return [
                    'success' => false,
                    'message' => 'Invalid JSON in register configuration file: '.json_last_error_msg(),
                ];
            }

            $configVersion = $configData['info']['version'] ?? '0.0.0';

            $configurationService = $this->container->get('OCA\OpenRegister\Service\ConfigurationService');
            $result = $configurationService->importFromApp(
                appId: Application::APP_ID,
                data: $configData,
                version: $configVersion,
                force: $force
            );

            if (empty($result) === false) {
                $this->logger->info('PetStore: register configuration imported successfully');
                return [
                    'success' => true,
                    'message' => 'Configuration imported successfully.',
                    'version' => $configVersion,
                ];
            }

            return [
                'success' => false,
                'message' => 'Import returned an empty result.',
            ];
        } catch (\Throwable $e) {
            $this->logger->error(
                'PetStore: configuration import failed',
                ['exception' => $e->getMessage()]
            );
            return [
                'success' => false,
                'message' => $e->getMessage(),
            ];
        }//end try
    }//end importConfiguration()
}//end class
