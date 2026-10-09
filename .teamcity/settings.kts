import jetbrains.buildServer.configs.kotlin.*
import jetbrains.buildServer.configs.kotlin.buildFeatures.commitStatusPublisher
import jetbrains.buildServer.configs.kotlin.buildFeatures.pullRequests
import jetbrains.buildServer.configs.kotlin.buildFeatures.sshAgent
import jetbrains.buildServer.configs.kotlin.buildSteps.exec
import jetbrains.buildServer.configs.kotlin.buildSteps.nodeJS
import jetbrains.buildServer.configs.kotlin.triggers.vcs

version = "2026.1"

object Config {
    const val GITHUB_URL = "git@github.com:ImFusionGmbH/test-mirror.git"
}

project {
    description = "Type-checks every branch and mirrors the default branch, including Git LFS objects, to the public GitHub repository"

    buildType(TypecheckMirrorToGithub)
}

object TypecheckMirrorToGithub : BuildType({
    name = "Typecheck/Mirror To Github"
    description = "Type-checks the demos with tsc and mirrors changes to the default branch to Github."

    features {
        sshAgent { teamcitySshKey = "GithubDeployKey" }
        commitStatusPublisher { publisher = bitbucketServer { authType = vcsRoot() } }
        pullRequests { provider = bitbucketServer { authType = vcsRoot() } }
    }

    params {
        param(
            "env.GIT_SSH_COMMAND",
            "ssh -o UserKnownHostsFile=%teamcity.build.checkoutDir%/.teamcity/github_known_hosts -o StrictHostKeyChecking=yes",
        )
    }

    vcs {
        root(DslContext.settingsRoot)
        cleanCheckout = true
    }

    steps {
        nodeJS {
            name = "Typecheck"
            id = "typecheck"
            shellScript =
                """
                npm ci
                npm run typecheck
                """.trimIndent()
            dockerImage = "docker.io/library/node:24-bookworm"
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
