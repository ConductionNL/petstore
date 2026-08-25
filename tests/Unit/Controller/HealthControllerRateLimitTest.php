<?php

/**
 * Health endpoint rate-limit declaration.
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
 */

declare(strict_types=1);

namespace OCA\PetStore\Tests\Unit\Controller;

use OCA\PetStore\Controller\HealthController;
use OCP\AppFramework\Http\Attribute\AnonRateLimit;
use PHPUnit\Framework\TestCase;
use ReflectionMethod;

/**
 * The health endpoint is the app's only anonymously-reachable route, and every
 * public endpoint needs a volume ceiling (ADR-082).
 *
 * Asserted by REFLECTION on the attribute rather than by driving the endpoint,
 * because the ceiling is not this controller's behaviour to enforce — Nextcloud's
 * middleware reads the attribute and does the counting. A test that called
 * `index()` in a loop would exercise the middleware's absence in a unit context
 * and pass whether or not the attribute were there, which is precisely the shape
 * of test that let this endpoint ship unthrottled in the first place.
 */
class HealthControllerRateLimitTest extends TestCase {
	/**
	 * @return void
	 */
	public function testIndexDeclaresAnAnonymousRateLimit(): void {
		$attributes = (new ReflectionMethod(HealthController::class, 'index'))
			->getAttributes(AnonRateLimit::class);

		$this->assertCount(
			1,
			$attributes,
			'HealthController::index is anonymously reachable and MUST carry '
			. '#[AnonRateLimit] per ADR-082 — without it an unauthenticated '
			. 'caller can poll it as fast as the server answers, and each call '
			. 'reaches through to SettingsService::isOpenRegisterAvailable().'
		);
	}

	/**
	 * The numbers matter, not just the presence of the attribute.
	 *
	 * 240/minute is deliberately generous and matches openregister's
	 * GenericHealthController: monitoring polls this on a short interval, and a
	 * ceiling that trips on a normal probe cadence gets removed rather than
	 * tuned — which would leave the endpoint unthrottled again.
	 *
	 * @return void
	 */
	public function testTheCeilingIsGenerousEnoughToSurviveMonitoring(): void {
		$arguments = (new ReflectionMethod(HealthController::class, 'index'))
			->getAttributes(AnonRateLimit::class)[0]
			->getArguments();

		$this->assertSame(240, $arguments['limit'] ?? $arguments[0] ?? null);
		$this->assertSame(60, $arguments['period'] ?? $arguments[1] ?? null);
	}
}
