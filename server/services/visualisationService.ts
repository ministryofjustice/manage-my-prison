import * as vega from 'vega'
import * as vegaLite from 'vega-lite'

import { SelectObjectContentCommandInput } from '@aws-sdk/client-s3'
import config from '../config'
import AthenaClient from '../data/athenaClient'
import S3Client from '../data/s3Client'

const positiveBehaviourColour = '#48659E'
const negativeBehaviourColour = '#9FB3DD'

const totalColour = negativeBehaviourColour
const basicLevelColour = positiveBehaviourColour

export default class VisualisationService {
  constructor(private readonly s3Client: S3Client, private readonly athenaClient?: AthenaClient) {}

  /**
   * Gets an example visualisation from S3 and returns the rendered SVG.
   *
   * Data is embedded/hardcoded into the visualisation in this example.
   *
   * @returns a Promise<string> with the SVG of the rendered visualisation.
   */
  async getViz1(): Promise<string> {
    // Example Vega bar chart visualisation:
    // https://github.com/vega/vega/blob/master/docs/examples/bar-chart.vg.json
    const data = await this.s3Client.getObject('sandbox/bar-chart.vg.json')
    const spec: vega.Spec = JSON.parse(data)

    const view = new vega.View(vega.parse(spec))
    return view.toSVG()
  }

  /**
   * Gets an example visualisation from S3, gets data from S3 using S3 Select and
   * returns the rendered visualisation.
   *
   * Some example of S3 Select queries are also included (commented) in the code.
   * An example of a possible way to filter data in Vega is also included
   * (commented) in the code.
   *
   * @returns a Promise<string> with the SVG of the rendered visualisation.
   */
  async getViz2(): Promise<string> {
    // Example Vega bar chart visualisation:
    // https://github.com/vega/vega/blob/master/docs/examples/bar-chart.vg.json
    const specData = await this.s3Client.getObject('sandbox/bar-chart.vg.json')
    const spec = JSON.parse(specData)

    // TODO: Updated fill colour to distinguish 2nd visualisation
    spec.marks[0].encode.update.fill.value = 'purple'

    const s3selectParams: SelectObjectContentCommandInput = {
      Bucket: config.s3.bucket,
      Key: 'sandbox/viz2-data.csv',
      ExpressionType: 'SQL',
      Expression: `SELECT category, amount FROM s3object`,
      // Expression: `SELECT category, amount FROM s3object WHERE category IN ('A', 'B', 'I', 'L')`,
      // Expression: `SELECT category, amount FROM s3object WHERE category IN ('Z')`,
      // Expression: `SELECT category, amount FROM s3object WHERE CAST(amount AS NUMERIC) < 50`,
      // Expression: `SELECT category, amount FROM s3object WHERE amount < 50`, // This doesn't work, need CAST
      InputSerialization: {
        CSV: {
          FileHeaderInfo: 'USE',
          RecordDelimiter: '\n',
          FieldDelimiter: ',',
        },
      },
      OutputSerialization: {
        JSON: {
          RecordDelimiter: ',',
        },
      },
    }

    const s3SelectResult = await this.s3Client.selectObjectContent(s3selectParams)

    spec.data = [
      {
        name: 'table',
        values: s3SelectResult,
        // NOTE: Vega also has ways to transform data, e.g. to filter it
        // SEE: https://vega.github.io/vega/docs/transforms/
        // transform: [
        //   {
        //     type: 'filter',
        //     expr: 'datum.amount > 20',
        //   },
        // ],
      },
    ]

    const view = new vega.View(vega.parse(spec))
    return view.toSVG()
  }

  /**
   * This example converts a VegaLite spec into Vega spec before rendering it.
   *
   * VegaLite is an higher level syntax for definiting visualisations (compared to than Vega).
   *
   * Spec and data are hardcoded in this example, it's mainly for the purpose of
   * showing how to convert VegaLite specs into Vega specs for rendering.
   *
   * @returns a Promise<string> with the SVG of the rendered visualisation.
   */
  getViz3(): Promise<string> {
    const vegaLiteSpec: vegaLite.TopLevelSpec = {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      description: 'A simple bar chart with embedded data.',
      width: 400,
      height: 200,
      data: {
        values: [
          { a: 'A', b: 28 },
          { a: 'B', b: 55 },
          { a: 'C', b: 43 },
          { a: 'D', b: 91 },
          { a: 'E', b: 81 },
          { a: 'F', b: 53 },
          { a: 'G', b: 19 },
          { a: 'H', b: 87 },
          { a: 'I', b: 52 },
        ],
      },
      mark: 'bar',
      encoding: {
        x: { field: 'a', type: 'ordinal' },
        y: { field: 'b', type: 'quantitative' },
      },
    }

    // `vega-lite`'s `compile()` converts a Vega-Lite specification into a Vega one
    const { spec: vegaSpec } = vegaLite.compile(vegaLiteSpec)

    const view = new vega.View(vega.parse(vegaSpec))
    return view.toSVG()
  }

  /**
   * Percentage of the basic population compared with percentage of the total population
   * by age group.
   *
   * See Miro board, Alpha sprint 4 - chart 1 - expanded
   *
   * @returns a Promise<string> with the SVG of the rendered visualisation.
   */
  async getVizPopulation(): Promise<string> {
    const vegaLiteSpec: vegaLite.TopLevelSpec = {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      data: {
        values: [
          { age_group: '21-24', level: 'all', people: 0.12 },
          { age_group: '21-24', level: 'basic', people: 0.23 },

          { age_group: '25-29', level: 'all', people: 0.18 },
          { age_group: '25-29', level: 'basic', people: 0.26 },

          { age_group: '30-39', level: 'all', people: 0.32 },
          { age_group: '30-39', level: 'basic', people: 0.35 },

          { age_group: '40-49', level: 'all', people: 0.19 },
          { age_group: '40-49', level: 'basic', people: 0.13 },

          { age_group: '50-59', level: 'all', people: 0.12 },
          { age_group: '50-59', level: 'basic', people: 0.04 },

          { age_group: '60', level: 'all', people: 0.12 },
          { age_group: '60', level: 'basic', people: 0.04 },

          { age_group: '60+', level: 'all', people: 0.07 },
          { age_group: '60+', level: 'basic', people: 0.01 },
        ],
      },
      transform: [
        {
          calculate: "datum.level == 'all' ? '% of total population' : '% of basic population'",
          as: 'level',
        },
      ],
      facet: {
        column: {
          field: 'age_group',
          type: 'ordinal',
          header: { orient: 'bottom' },
          title: 'Age group',
          sort: 'ascending',
        },
      },
      spec: {
        layer: [
          {
            mark: {
              type: 'bar',
              width: {
                band: 1.1,
              },
            },
            encoding: {
              y: {
                field: 'people',
                aggregate: 'sum',
                type: 'quantitative',
                axis: {
                  grid: false,
                  values: [0, 0.1, 0.2, 0.3, 0.4],
                  format: '%',
                },
                scale: {
                  domain: [0, 0.4],
                },
                title: null,
              },
              x: {
                field: 'level',
                axis: null,
              },
              color: {
                field: 'level',
                title: null,
                scale: {
                  domain: ['% of basic population', '% of total population'],
                  range: [basicLevelColour, totalColour],
                },
                legend: {
                  direction: 'horizontal',
                  orient: 'bottom',
                  labelFontSize: 9,
                },
              },
            },
          },
          {
            mark: {
              type: 'text',
              align: 'center',
              baseline: 'bottom',
              dy: -2,
            },
            encoding: {
              text: {
                type: 'quantitative',
                field: 'people',
                aggregate: 'sum',
                format: '.0%',
              },
              x: {
                type: 'ordinal',
                axis: {
                  grid: false,
                  title: '',
                },
                field: 'level',
              },
              y: {
                field: 'people',
                aggregate: 'sum',
                type: 'quantitative',
              },
            },
          },
        ],
      },
      width: { step: 30 },
      config: {
        view: {
          stroke: 'transparent',
        },
      },
    }

    // `vega-lite`'s `compile()` converts a Vega-Lite specification into a Vega one
    const { spec: vegaSpec } = vegaLite.compile(vegaLiteSpec)

    const view = new vega.View(vega.parse(vegaSpec))
    return view.toSVG()
  }
}
