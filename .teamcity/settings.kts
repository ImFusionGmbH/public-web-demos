import jetbrains.buildServer.configs.kotlin.*
import jetbrains.buildServer.configs.kotlin.buildFeatures.commitStatusPublisher
import jetbrains.buildServer.configs.kotlin.buildFeatures.pullRequests
import jetbrains.buildServer.configs.kotlin.buildFeatures.sshAgent
import jetbrains.buildServer.configs.kotlin.buildSteps.exec
import jetbrains.buildServer.configs.kotlin.triggers.vcs

version = "2026.2"

object Config {
    const val GITHUB_URL = "git@github.com:ImFusionGmbH/public-web-demos.git"
    const val NODE_IMAGE = "docker.io/library/node:24-bookworm"
}

project {
    description = TypecheckMirrorToGithub.description

    buildType(TypecheckMirrorToGithub)
}

object TypecheckMirrorToGithub : BuildType({
    name = "Typecheck/Mirror to GitHub"
    description = "Type-checks the demos and mirrors the repository, including Git LFS objects, to the public GitHub repository"

    maxRunningBuildsPerBranch =
        """
        <default>:0
        *:1
        """.trimIndent()
    runningBuildsLimitingMode = BuildsLimitingMode.CANCEL_OLDEST_RUNNING_BUILD

    features {
        sshAgent { teamcitySshKey = "public-demos" }
        commitStatusPublisher { publisher = bitbucketServer { authType = vcsRoot() } }
        pullRequests { provider = bitbucketServer { authType = vcsRoot() } }
    }

    params {
        text(
            "env.GIT_SSH_COMMAND",
            "ssh -o UserKnownHostsFile=%teamcity.build.checkoutDir%/.teamcity/github_known_hosts -o StrictHostKeyChecking=yes",
            readOnly = true,
        )
        text(
            "env.NPM_CONFIG_CACHE",
            "%teamcity.agent.home.dir%/cache/%teamcity.build.default.checkoutDir%/npm",
            readOnly = true,
        )
    }

    vcs {
        root(DslContext.settingsRoot)
        cleanCheckout = true
    }

    steps {
        exec {
            name = "Install NPM dependencies"
            id = "install_npm_dependencies"
            path = "npm"
            arguments = "ci"
            dockerImage = Config.NODE_IMAGE
            dockerRunParameters = "--volume %teamcity.agent.home.dir%/cache:%teamcity.agent.home.dir%/cache"
        }

        exec {
            name = "Typecheck demos"
            id = "typecheck_demos"
            path = "npm"
            arguments = "run typecheck"
            dockerImage = Config.NODE_IMAGE
            dockerRunParameters = "--volume %teamcity.agent.home.dir%/cache:%teamcity.agent.home.dir%/cache"
        }

        exec {
            name = "Push LFS objects to GitHub"
            id = "push_lfs_objects_to_github"
            conditions {
                equals("teamcity.build.branch.is_default", "true")
            }

            path = "git"
            arguments =
                """
                lfs push
                ${Config.GITHUB_URL}
                %build.vcs.number.${DslContext.settingsRoot.id}%
                """.trimIndent()
        }

        exec {
            name = "Push branch to GitHub"
            id = "push_branch_to_github"
            conditions {
                equals("teamcity.build.branch.is_default", "true")
            }

            path = "git"
            arguments =
                """
                push
                ${Config.GITHUB_URL}
                %build.vcs.number.${DslContext.settingsRoot.id}%:refs/heads/master
                """.trimIndent()
        }
    }

    triggers {
        vcs { branchFilter = "+:*" }
    }

    requirements {
        contains("teamcity.agent.jvm.os.name", "Linux")
    }
})
