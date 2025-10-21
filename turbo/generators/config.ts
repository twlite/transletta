import type { PlopTypes } from '@turbo/gen';

export default function generator(plop: PlopTypes.NodePlopAPI) {
  const destination = plop.getDestBasePath();

  plop.setGenerator('bootstrap', {
    description: 'Bootstrap a new package',
    prompts: [
      {
        type: 'input',
        name: 'name',
        message: 'What is the name of the package?',
      },
      {
        type: 'input',
        name: 'description',
        message: 'What is the description of the package?',
      },
    ],
    actions: [
      {
        type: 'addMany',
        templateFiles: ['templates/**/*'],
        base: 'templates',
        destination: `${destination}/packages/{{name}}`,
        stripExtensions: ['hbs'],
        abortOnFail: true,
      },
    ],
  });
}
