# DEC-2026-07-19 — No Microsoft Marketplace proxy

**Status:** Accepted  
**Phase:** D  
**Related:** `docs/phase-D/NO_MARKETPLACE_PROXY.md`, NFR-F07, FR-F12

## Decision

WalkCroach Desktop uses Open VSX only. No reverse-proxy or workaround to `marketplace.visualstudio.com` at any time.

## Why

Cursor’s April 2025 Marketplace enforcement; January 2026 Open VSX namesquatting class.

## Consequences

Proprietary Microsoft extensions are listed in `product/incompatibles.proprietary.json` with open alternatives — never fetched from Marketplace.

## Revisit triggers

None without a written ADR that explicitly accepts ToS/enforcement risk (we will not).
