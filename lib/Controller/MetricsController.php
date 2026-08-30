<?php

/**
 * PetStore Metrics Controller
 *
 * Prometheus-style metrics endpoint (ADR-006).
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
 * @spec openspec/specs/observability/spec.md#REQ-OBS-001
 *   (Illustrative stub per ADR-006 — every app MUST expose `GET /api/metrics`
 *   as Prometheus text, admin auth. Replace the metric values with real data.
 *
 *   Point @spec at the canonical spec under `openspec/specs/`, never at
 *   `openspec/changes/<name>/` — see ConductionNL/.github#228.)
 */

declare(strict_types=1);

namespace OCA\PetStore\Controller;

use OCA\PetStore\AppInfo\Application;
use OCA\PetStore\Service\SettingsService;
use OCP\App\IAppManager;
use OCP\AppFramework\Controller;
use OCP\AppFramework\Http;
use OCP\AppFramework\Http\Attribute\NoCSRFRequired;
use OCP\AppFramework\Http\DataDisplayResponse;
use OCP\IRequest;
use Psr\Log\LoggerInterface;

/**
 * Prometheus metrics endpoint for PetStore (ADR-006).
 *
 * Returns `text/plain; version=0.0.4` with `{app}_` prefixed metrics.
 * MUST include `{app}_health_status` and `{app}_info` per ADR-006.
 * Admin-only (no `@NoAdminRequired`) — ADR-006 mandates admin auth.
 *
 * @spec openspec/changes/document-petstore-domain-capabilities/tasks.md#task-3.2
 */
class MetricsController extends Controller {
	/**
	 * Metric prefix.
	 *
	 * @var string
	 */
	private const METRIC_PREFIX = 'petstore';

	/**
	 * Constructor.
	 *
	 * @param IRequest $request The request object
	 * @param SettingsService $settingsService For OpenRegister availability check
	 * @param IAppManager $appManager For reading the deployed app version
	 * @param LoggerInterface $logger The logger
	 *
	 * @return void
	 *
	 * @spec openspec/changes/document-petstore-domain-capabilities/tasks.md#task-3.2
	 */
	public function __construct(
		IRequest $request,
		private SettingsService $settingsService,
		private IAppManager $appManager,
		private LoggerInterface $logger,
	) {
		parent::__construct(appName: Application::APP_ID, request: $request);
	}//end __construct()

	/**
	 * Prometheus text exposition. Admin-only per ADR-006.
	 *
	 * "Admin-only" is the exact posture wording gate-30 recognises for a
	 * *metrics* controller, and it is the wording openregister's own
	 * GenericMetricsController — the engine that owns this decision — uses.
	 * This method previously said "Admin auth", which is the same posture in
	 * different words, so gate-30 read it as an UNDECLARED posture and asked
	 * for #[PublicPage]. Adding that attribute would have published this
	 * exposition to anonymous callers to satisfy a gate, so the fix is to
	 * state the posture the way the fleet states it, not to change it.
	 *
	 * Deliberately NOT #[PublicPage]. ADR-006 splits the two monitoring
	 * surfaces: `/api/metrics` is admin-authed, `/api/health` is public. The
	 * exposition carries the deployed app version and health state, so
	 * publishing it anonymously would be a real leak.
	 *
	 * #[NoCSRFRequired] declares the posture explicitly (NC defaults an
	 * un-attributed method to admin-required, which is correct here, but
	 * leaves the intent undeclared, and gate-5 cannot tell a deliberate admin
	 * endpoint from a forgotten attribute) and is what actually makes the
	 * route reachable for its consumer: a Prometheus scraper is not a browser
	 * and carries no CSRF token. Admin auth still applies — that comes from
	 * the ABSENCE of #[NoAdminRequired], which is not added here.
	 *
	 * @return DataDisplayResponse
	 *
	 * @spec openspec/changes/document-petstore-domain-capabilities/tasks.md#task-3.2
	 */
	#[NoCSRFRequired]
	public function index(): DataDisplayResponse {
		try {
			$prefix = self::METRIC_PREFIX;
			$healthy = (int)$this->settingsService->isOpenRegisterAvailable();
			$version = $this->appManager->getAppVersion(appId: Application::APP_ID);

			$lines = [
				'# HELP ' . $prefix . '_info Static app information',
				'# TYPE ' . $prefix . '_info gauge',
				$prefix . '_info{app="' . Application::APP_ID . '",version="' . $version . '"} 1',
				'# HELP ' . $prefix . '_health_status 1 when OpenRegister reachable, 0 otherwise',
				'# TYPE ' . $prefix . '_health_status gauge',
				$prefix . '_health_status ' . $healthy,
			];

			return new DataDisplayResponse(
				implode("\n", $lines) . "\n",
				Http::STATUS_OK,
				['Content-Type' => 'text/plain; version=0.0.4; charset=utf-8']
			);
		} catch (\Throwable $e) {
			$this->logger->error('PetStore: metrics generation failed', ['exception' => $e]);
			return new DataDisplayResponse('', Http::STATUS_INTERNAL_SERVER_ERROR);
		}//end try
	}//end index()
}//end class
