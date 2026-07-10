## [1.11.3](https://github.com/moui72/assisted-review/compare/v1.11.2...v1.11.3) (2026-07-10)


### Bug Fixes

* **ui:** Log running app version on launch ([#75](https://github.com/moui72/assisted-review/issues/75)) ([8443115](https://github.com/moui72/assisted-review/commit/8443115cee365cdc2130776ca592d7e10af1b738))

## [1.11.2](https://github.com/moui72/assisted-review/compare/v1.11.1...v1.11.2) (2026-07-10)


### Bug Fixes

* **ci:** pin npm version in publish workflow, remove Codecov upload ([#73](https://github.com/moui72/assisted-review/issues/73)) ([f60cc09](https://github.com/moui72/assisted-review/commit/f60cc098ceaea8c973fee397c77a2cb7e9f6bf26))

## [1.11.1](https://github.com/moui72/assisted-review/compare/v1.11.0...v1.11.1) (2026-07-10)


### Bug Fixes

* **ardd:** complete ardd-verify-pass defect fixes ([#72](https://github.com/moui72/assisted-review/issues/72)) ([b4e5e35](https://github.com/moui72/assisted-review/commit/b4e5e353fdf98152d412bf3ddf15f64d600bbef2))

# [1.11.0](https://github.com/moui72/assisted-review/compare/v1.10.0...v1.11.0) (2026-07-08)


### Features

* Claude investigation tool access (local checkout / full-file API / clone modes) ([#63](https://github.com/moui72/assisted-review/issues/63)) ([3b1fb75](https://github.com/moui72/assisted-review/commit/3b1fb754e348988179fb4bc007a960e7bcf32cce)), closes [moui72/assisted-review#62](https://github.com/moui72/assisted-review/issues/62)

# [1.10.0](https://github.com/moui72/assisted-review/compare/v1.9.0...v1.10.0) (2026-07-07)


### Features

* **cli:** non-intrusive update-check notice on startup ([#62](https://github.com/moui72/assisted-review/issues/62)) ([bf08e56](https://github.com/moui72/assisted-review/commit/bf08e562bce571109ebb4b7b6616933638b0c2dc))

# [1.9.0](https://github.com/moui72/assisted-review/compare/v1.8.0...v1.9.0) (2026-07-06)


### Features

* **ui:** preload loading state ([#61](https://github.com/moui72/assisted-review/issues/61)) ([42aadf3](https://github.com/moui72/assisted-review/commit/42aadf3964b3ebcc951510a434fab668b075af5d)), closes [#60](https://github.com/moui72/assisted-review/issues/60) [#60](https://github.com/moui72/assisted-review/issues/60)

# [1.8.0](https://github.com/moui72/assisted-review/compare/v1.7.0...v1.8.0) (2026-07-06)


### Features

* **ui:** inline comment editing ([#60](https://github.com/moui72/assisted-review/issues/60)) ([c1ee6f8](https://github.com/moui72/assisted-review/commit/c1ee6f82d73a8b10c6e7ade105cb071c26dd2db6))

# [1.7.0](https://github.com/moui72/assisted-review/compare/v1.6.1...v1.7.0) (2026-07-05)


### Features

* **gitlab:** resilient submit with retry and partial-failure handling ([#57](https://github.com/moui72/assisted-review/issues/57)) ([303758f](https://github.com/moui72/assisted-review/commit/303758f9da414db20fbba777c4a81fbb0cd3f15e)), closes [#58](https://github.com/moui72/assisted-review/issues/58)

## [1.6.1](https://github.com/moui72/assisted-review/compare/v1.6.0...v1.6.1) (2026-07-05)


### Bug Fixes

* **api:** cancel in-flight Claude stream on new /api/claude request (T001-T003) ([#54](https://github.com/moui72/assisted-review/issues/54)) ([d68adf5](https://github.com/moui72/assisted-review/commit/d68adf569ed5e58ee0405de1745b5174fb230d70))

# [1.6.0](https://github.com/moui72/assisted-review/compare/v1.5.1...v1.6.0) (2026-07-04)


### Features

* **ui:** add detectMac() OS-detection helper ([#53](https://github.com/moui72/assisted-review/issues/53)) ([0310866](https://github.com/moui72/assisted-review/commit/031086609257ae585a131078eea8da3cccaaee6a))

## [1.5.1](https://github.com/moui72/assisted-review/compare/v1.5.0...v1.5.1) (2026-07-04)


### Bug Fixes

* **ui:** show empty-state message instead of dead Begin Review button ([#52](https://github.com/moui72/assisted-review/issues/52)) ([680b435](https://github.com/moui72/assisted-review/commit/680b4350f90d2cb453a47fb12652c5f9895ad2a6))

# [1.5.0](https://github.com/moui72/assisted-review/compare/v1.4.0...v1.5.0) (2026-07-02)


### Features

* browser-based GitLab PAT entry with server-side token persistence ([#50](https://github.com/moui72/assisted-review/issues/50)) ([2063a05](https://github.com/moui72/assisted-review/commit/2063a05d84bb455a4de6e9bf08de627185ee8dce))

# [1.4.0](https://github.com/moui72/assisted-review/compare/v1.3.0...v1.4.0) (2026-06-27)


### Features

* add GitLab MR review support ([#47](https://github.com/moui72/assisted-review/issues/47)) ([7119b16](https://github.com/moui72/assisted-review/commit/7119b1698ddea872a0d7acb93a882970f4162a52))

# [1.3.0](https://github.com/moui72/assisted-review/compare/v1.2.1...v1.3.0) (2026-06-24)


### Features

* add Playwright e2e smoke test and build check to CI ([#45](https://github.com/moui72/assisted-review/issues/45)) ([a808730](https://github.com/moui72/assisted-review/commit/a808730c9dccac5c21b5f846c0c4d93d1879a338))

## [1.2.1](https://github.com/moui72/assisted-review/compare/v1.2.0...v1.2.1) (2026-06-24)


### Bug Fixes

* destructure onOpenSettings prop in TopNav ([#44](https://github.com/moui72/assisted-review/issues/44)) ([f375f10](https://github.com/moui72/assisted-review/commit/f375f10e13b65b4ea761df838fd4a4116e5d061a))

# [1.2.0](https://github.com/moui72/assisted-review/compare/v1.1.0...v1.2.0) (2026-06-23)


### Features

* TopNav logo fix, settings panel, Jira config, and test coverage ([#42](https://github.com/moui72/assisted-review/issues/42)) ([3104b4a](https://github.com/moui72/assisted-review/commit/3104b4a3609f05e17ff3fd79310f8add17e03101))

# [1.1.0](https://github.com/moui72/assisted-review/compare/v1.0.1...v1.1.0) (2026-06-22)


### Features

* Jira configure wizard + preload config endpoint ([#41](https://github.com/moui72/assisted-review/issues/41)) ([87cfcdd](https://github.com/moui72/assisted-review/commit/87cfcdd84fa310febb3948b22caeee90493e7cfc))

## [1.0.1](https://github.com/moui72/assisted-review/compare/v1.0.0...v1.0.1) (2026-06-22)


### Bug Fixes

* use icon variant of logo in TopNav for legibility ([#40](https://github.com/moui72/assisted-review/issues/40)) ([e1e1524](https://github.com/moui72/assisted-review/commit/e1e15242f859fbad4cf8dde97600b036e9f5b80a))

# 1.0.0 (2026-06-22)


### Bug Fixes

* address review feedback on PR [#11](https://github.com/moui72/assisted-review/issues/11) ([089afe1](https://github.com/moui72/assisted-review/commit/089afe14a1c88042b1288bed372189deb23cc7b7))
* invoke tsc and vite via node path, not bin symlinks ([d40801f](https://github.com/moui72/assisted-review/commit/d40801f2770f9f30217d82440775c2d09c3e78f3))
* replace `as any` casts with typed mock helpers ([d58373d](https://github.com/moui72/assisted-review/commit/d58373db74bb7a9120c68e3f03d05da1de97889b))
* switch-then-delete when dismissing the active review ([5849aaf](https://github.com/moui72/assisted-review/commit/5849aaf662b8d6fa76ce92e38689d91585787c57))
* use npm trusted publishing (OIDC, no token) ([4aa1ef8](https://github.com/moui72/assisted-review/commit/4aa1ef82a7ab91848407a12b2de9e0b6d07fbbe8))
* use npx --no-install in build scripts so npm git-URL installs work ([ab6a3a5](https://github.com/moui72/assisted-review/commit/ab6a3a57a32baf51422bb6ec46c078b69c87a50f))


### Features

* automatic semantic versioning via semantic-release ([fa7d6bc](https://github.com/moui72/assisted-review/commit/fa7d6bce6aca6e9b5c14d1d055f824b8aa72dd0a))
* confirm before deleting active review, allow clearing to splash ([8335dfa](https://github.com/moui72/assisted-review/commit/8335dfa69d37f5a0ce463beeaafef8e4d10b952f))
* new readme logo ([25d77db](https://github.com/moui72/assisted-review/commit/25d77dbf166f8036ad4773015d6bdf72c83c49c8))
* pixel-art logo + light mode ([#37](https://github.com/moui72/assisted-review/issues/37)) ([e8629b2](https://github.com/moui72/assisted-review/commit/e8629b257d20c1a954ec4dab1c1b979edcaf164c)), closes [#f5f1e6](https://github.com/moui72/assisted-review/issues/f5f1e6) [#39454f](https://github.com/moui72/assisted-review/issues/39454f)
* publish to npm on merge to main ([af306b5](https://github.com/moui72/assisted-review/commit/af306b5e5047d8c60ca1f572f4a04d6527d9013e))
* review picker + launch new reviews from UI ([c30b308](https://github.com/moui72/assisted-review/commit/c30b308e887f0b2354a4569d658705e8bc2291ee)), closes [owner/repo#N](https://github.com/owner/repo/issues/N)
