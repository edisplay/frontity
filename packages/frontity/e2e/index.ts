/* eslint-disable no-irregular-whitespace */
import execa from "execa";

// We need to set a high timeout because building the docker container and
// running `frontity create` takes a long time.
jest.setTimeout(180000);

/**
 * Options for the {@link testContainer} function.
 */
interface TestContainerCallbackOptions {
  /**
   * The ID of the docker container.
   */
  containerId: string;

  /**
   * The function used to actually run the command inside the container.
   */
  runCommand: (
    cmd: string,
    options?: Record<string, any>
  ) => ReturnType<typeof runCommand>;
}

/**
 * A helper function to test containers.
 *
 * @param callback - The callback function.
 * @returns - A function ready to be passed to a jest test.
 */
const testContainer = (
  callback: (callback: TestContainerCallbackOptions) => any
) => async () => {
  let containerId: string;
  try {
    containerId = await startContainer();
    await callback({
      containerId,
      runCommand: (cmd, options) => runCommand(cmd, containerId, options),
    });
  } finally {
    await execa.command(`docker rm --force ${containerId}`, {
      stdio: "ignore",
    });
  }
};

beforeAll(async () => {
  // Remove the built output
  await execa.command("rm -rf build", { stdio: "inherit" });

  // Compile the TS source to JS
  await execa.command("npm run build", { stdio: "inherit" });

  // Run `npm pack`
  const { stdout: artifactName } = await execa.command("npm pack", {
    stdio: "pipe", // `pipe` because we want to get the name of the tarball generated by npm pack
  });

  // Build the "base" docker container that contains our CLI
  await execa.command(
    `docker build -t frontity-cli --build-arg ARTIFACT_NAME=${artifactName} .`,
    {
      stdio: "ignore",
    }
  );

  await execa.command(`rm ${artifactName}`);
});

test.concurrent(
  "in container without git",
  testContainer(async ({ runCommand }) => {
    await runCommand(
      `node_modules/.bin/frontity create --no-prompt --theme @frontity/mars-theme test-frontity-app`
    );

    let output = await runCommand("ls -a test-frontity-app");
    expect(output).toMatchInlineSnapshot(`
        ".
        ..
        README.md
        favicon.ico
        frontity.settings.js
        node_modules
        package-lock.json
        package.json
        packages"
      `);

    output = await runCommand("tree test-frontity-app/packages/");
    expect(output).toMatchInlineSnapshot(`
              "test-frontity-app/packages/
              └── mars-theme
                  ├── CHANGELOG.md
                  ├── README.md
                  ├── package.json
                  ├── src
                  │   ├── components
                  │   │   ├── featured-media.js
                  │   │   ├── header.js
                  │   │   ├── index.js
                  │   │   ├── link.js
                  │   │   ├── list
                  │   │   │   ├── index.js
                  │   │   │   ├── list-item.js
                  │   │   │   ├── list.js
                  │   │   │   └── pagination.js
                  │   │   ├── loading.js
                  │   │   ├── menu-icon.js
                  │   │   ├── menu-modal.js
                  │   │   ├── menu.js
                  │   │   ├── nav.js
                  │   │   ├── page-error.js
                  │   │   ├── post.js
                  │   │   └── title.js
                  │   └── index.js
                  └── types.ts

              4 directories, 21 files"
          `);
  })
);

test.concurrent(
  "in container with git installed",
  testContainer(async ({ runCommand }) => {
    await runCommand("apk add git");
    await runCommand(
      `node_modules/.bin/frontity create --no-prompt --theme @frontity/mars-theme test-frontity-app`,
      { stdio: "inherit" }
    );

    const output = await runCommand("ls -a test-frontity-app");
    expect(output).toMatchInlineSnapshot(`
      ".
      ..
      .git
      README.md
      favicon.ico
      frontity.settings.js
      node_modules
      package-lock.json
      package.json
      packages"
    `);
  })
);

/**
 * Start a container and return its ID.
 *
 * @returns The ID of the container.
 */
async function startContainer() {
  // start the container
  const { stdout: containerId } = await execa.command(
    "docker run --rm -i -d frontity-cli node",
    {
      stdio: "pipe",
    }
  );
  return containerId;
}

/**
 * Run an arbitrary command in a container.
 *
 * @param cmd - The command to execute.
 * @param containerId - The ID of the container.
 * @param options - The `options` option of child_process.
 * @returns Stdout returned from the command.
 */
async function runCommand(
  cmd: string,
  containerId: string,
  options?: {
    /**
     * Stdio option of child_process.exec.
     */
    stdio?: ["ignore", "pipe", "inherit"];
  }
) {
  const { stdout } = await execa(
    "docker",
    ["exec", "-i", containerId, "sh", "-c", cmd],
    options
  );

  return stdout;
}
