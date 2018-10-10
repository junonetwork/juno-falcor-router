import { readFileSync } from 'fs';
import express from 'express';
import morgan from 'morgan';
import { dataSourceRoute } from 'falcor-express';
import createRouter from './falcor';
import { GraphDescription, ContextMap } from './types';
import memoryAdapter from './adapters/memory';


const PORT = process.env.PORT || 3000;

const SEED = process.env.SEED || `${__dirname}/../seed.n3`;

// create context
let context: ContextMap | undefined;;
if (process.env.CONTEXT) {
  // TODO - validate
  context = JSON.parse(readFileSync(process.env.CONTEXT, 'utf8'));
}


// create graphs
const rdf = `
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix skos: <http://www.w3.org/2004/02/skos/core#> .
rdf:type a rdf:Property ;
    rdfs:isDefinedBy <http://www.w3.org/1999/02/22-rdf-syntax-ns#> ;
    rdfs:comment "The subject is an instance of a class." ;
    rdfs:range rdfs:Class ;
    rdfs:domain rdfs:Resource ;
    skos:prefLabel "Type" .
`;
const skos = `
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix skos: <http://www.w3.org/2004/02/skos/core#> .
skos:prefLabel a rdf:Property ;
    skos:prefLabel "Label"@en .
`;


// TODO - should domains need to take curies?
Promise.all([
  memoryAdapter({ n3: readFileSync(SEED, 'utf8'), context }),
  memoryAdapter({ n3: rdf, context }),
  memoryAdapter({ n3: skos, context })
]).then(([trumpWorldAdapter, rdfAdapter, skosAdapter]) => {
  const graphs: GraphDescription[] = [{
    key: 'trump-world',
    label: 'Trump World',
    domains: [/^http:\/\/juno\.network\/trumpworld/],
    adapter: trumpWorldAdapter,
  }, {
    key: 'rdf',
    domains: [/^rdf:/],
    adapter: rdfAdapter,
  }, {
    key: 'skos',
    domains: [/^skos:/],
    adapter: skosAdapter,
  }];

  // Create App
  const app = express();

  if (process.env.NODE_ENV !== 'test') {
    app.use(morgan('combined'));
  }

  const Router = createRouter({ context, graphs });
  app.use('/api/model.json', dataSourceRoute(() => new Router({ user: 'test-user' }))); // TODO - adapters should be initialized w/ each request

  const router = new Router({ user: 'test-user' });

  router.get([['graph', 'trump-world', 'type=ABC', 10, 'rdf:label', 0]])
    .subscribe((res) => console.log(JSON.stringify(res)), (err) => console.error(err));

  // Error handling
  // app.use((err, req, res, next) => {
  //   console.error(err);
  //   req.status(500).send({
  //     name: err.name,
  //     message: err.message,
  //     stack: err.stack
  //   });
  // });


  // app.listen(PORT, () => {
  //   console.log(`listening on port ${PORT}`);
  // });
});
