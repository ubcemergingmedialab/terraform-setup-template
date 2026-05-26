# Workflow diagrams

All diagrams use [Mermaid](https://mermaid.js.org/), which GitHub renders natively. If you're reading this in a plain-text editor and seeing source code instead of pictures, open the file on GitHub.

## 1. The big picture — who talks to what

```mermaid
flowchart LR
    DEV([Lab member])
    GH[(GitHub repo<br/>lab-terraform)]
    CI{{GitHub Actions<br/>fmt + validate + tflint}}
    HCP[(HCP Terraform<br/>workspace per project)]
    AWS[(AWS account<br/>lab or client)]

    DEV -- edit .tf, push, PR --> GH
    GH -- triggers --> CI
    GH -- VCS-connected --> HCP
    HCP -- plans + applies --> AWS
    AWS -. real state .-> HCP
```

GitHub is the source of truth. HCP turns the truth into AWS resources. CI checks the truth is syntactically valid before we trust it.

---

## 2. Daily workflow — making a change to an existing project

```mermaid
flowchart TD
    A[Create feature branch] --> B[Edit .tf in<br/>projects/&lt;client&gt;/&lt;project&gt;/]
    B --> C[Commit + push]
    C --> D[Open PR on GitHub]
    D --> E[GitHub Actions:<br/>terraform fmt -check<br/>terraform validate<br/>tflint]
    D --> F[HCP runs speculative plan<br/>posts diff back to PR]
    E --> G{CI green?}
    F --> H{Plan output<br/>matches intent?}
    G -- no --> B
    H -- no --> B
    G -- yes --> I[Request review]
    H -- yes --> I
    I --> J[Reviewer approves]
    J --> K[Merge to main]
    K --> L[HCP runs real plan]
    L --> M[Lab member confirms<br/>apply in HCP UI]
    M --> N[AWS state updated]
    N --> O[Verify in AWS console<br/>or via outputs]
```

---

## 3. Starting a new client project

```mermaid
flowchart TD
    A[Decide client slug + project slug<br/>e.g. ubc-arts / splat-museum] --> B[Copy projects/_template<br/>to projects/ubc-arts/splat-museum]
    B --> C[Fill terraform.auto.tfvars]
    C --> D[In main.tf,<br/>compose the modules<br/>this project needs]
    D --> E[Push to feature branch<br/>+ open PR]
    E --> F[In HCP:<br/>New workspace<br/>VCS workflow<br/>Working dir = projects/ubc-arts/splat-museum]
    F --> G[Attach AWS creds<br/>variable set to workspace]
    G --> H[Set Auto-apply = OFF]
    H --> I[Merge PR]
    I --> J[HCP plans -> confirm apply]
    J --> K[Live in lab AWS account]
```

---

## 4. Adding a new reusable module

```mermaid
flowchart TD
    A[New AWS pattern recurs<br/>across 2+ projects] --> B[Create modules/&lt;name&gt;/]
    B --> C[Write main.tf with the resources<br/>variables.tf with inputs<br/>outputs.tf with outputs<br/>versions.tf with provider pins<br/>README.md with usage]
    C --> D[Validate locally? — can't, no CLI<br/>Push to branch, let CI validate]
    D --> E[Compose the module<br/>from one project to prove it works]
    E --> F[PR + review + merge]
    F --> G[Other projects can now<br/>reference modules/&lt;name&gt;/]
```

Rule of thumb: don't pre-build a module for "we might need this someday." Start in a project. When a second project wants the same shape, extract.

---

## 5. Transplanting a project to a client (delivery)

```mermaid
flowchart TD
    A[Project is ready to hand off] --> B[Identify exactly which modules<br/>projects/&lt;client&gt;/&lt;project&gt;/<br/>references]
    B --> C[Create a fresh GitHub repo<br/>owned by client<br/>e.g. ubc-arts/splat-museum-infra]
    C --> D[Copy projects/&lt;client&gt;/&lt;project&gt;/ contents<br/>to repo root]
    D --> E[Copy the referenced modules/<br/>into modules/ in the new repo]
    E --> F[Replace module source paths<br/>from ../../../modules/X<br/>to ./modules/X]
    F --> G[Strip / parameterize<br/>lab HCP organization name<br/>in versions.tf cloud block]
    G --> H[Client connects their HCP org<br/>to the new repo as VCS workspace]
    H --> I[Client sets their AWS credentials<br/>in their HCP workspace]
    I --> J[Client edits terraform.auto.tfvars<br/>with their values if any change]
    J --> K[Client merges + applies]
    K --> L[Resources in client's AWS account]
    L --> M[Optional: lab destroys<br/>its own copy of the project<br/>after a quiet period]
```

Full step-by-step lives in [`transplant.md`](./transplant.md).

---

## 6. Reverting a bad change

```mermaid
flowchart LR
    A[Bad apply landed] --> B[git revert &lt;commit&gt;<br/>on GitHub]
    B --> C[Open PR for the revert]
    C --> D[HCP plans the inverse change]
    D --> E[Confirm apply]
    E --> F[AWS back to previous state]
```

Infrastructure-as-code's superpower: `git revert` is your undo button.
