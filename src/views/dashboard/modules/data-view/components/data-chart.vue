<template lang="pug">
a-card.chart-card(v-if="hasChart" :bordered="false")
  template(v-if="hasHeader" #title)
    a-space(size="mini")
      svg.icon-18
        use(href="#chart")
      | {{ $t('dashboard.chart') }}
  a-spin(style="width: 100%")
    a-spin(style="width: 100%" :loading="isChartLoading")
      template(#element)
        a-space(direction="vertical" :size="30")
          a-space(:size="10")
            icon-exclamation-circle-fill.warning-color
            span.loading-tip {{ $t('dashboard.chartLoadingTip', { count: seriesCount }) }}
          a-button(type="primary" @click="showChart")
            | {{ $t('dashboard.ok') }}
      .chart-container(ref="chartContainerRef")
        Chart(:height="chartHeight" :option="chartOptions" :update-options="updateOptions")
    a-row
      a-form.chart-form(layout="inline" :model="chartForm")
        a-form-item(:label="$t('dashboard.chartType')")
          a-select(v-model="chartForm.chartType" :trigger-props="triggerProps")
            a-option(
              v-for="item of chartTypeOptions"
              :key="item.key"
              :value="item.value"
              :label="item.value"
            )
        a-form-item(:label="$t('dashboard.yType')")
          a-select(
            v-model="chartForm.selectedYTypes"
            multiple
            :placeholder="$t('dashboard.pleaseSelect')"
            :allow-search="false"
            :trigger-props="triggerProps"
          )
            a-option(v-for="item of yOptions" :value="item" :label="item") {{ item }}
        a-form-item(:label="$t('dashboard.xType')")
          a-select(
            v-model="chartForm.xAxisType"
            value-key="name"
            :placeholder="$t('dashboard.pleaseSelect')"
            :allow-search="false"
            :trigger-props="triggerProps"
          )
            a-option(v-for="item of xOptions" :value="item") {{ item.name }}
        a-form-item(:label="$t('dashboard.groupBy')")
          a-select(
            v-model="chartForm.groupBySelectedTypes"
            multiple
            allow-clear
            :disabled="isGroupByDisabled"
            :trigger-props="triggerProps"
          )
            a-option(v-for="item of groupByOptions" :key="item.index" :value="item.name") {{ item.name }}
</template>

<script lang="ts" setup>
  import { useElementSize } from '@vueuse/core'
  import type { PropType } from 'vue'
  import type { datasetType, ResultType, ChartFormType, SeriesType } from '@/store/modules/code-run/types'
  import useDataChart from '@/hooks/data-chart'
  import { groupByToMap } from '@/utils'
  import { useDateTimeFormat } from '@/hooks/use-date-time-format'
  import { chartTypeOptions, updateOptions } from '../../../config'

  const props = defineProps({
    data: {
      type: Object as PropType<ResultType>,
      default: () => ({
        records: { rows: [], schema: { column_schemas: [] } },
        dimensionsAndXName: {
          dimensions: [],
          xAxis: '',
        },
        key: -1,
        type: '',
      }),
    },
    defaultChartForm: {
      type: Object as PropType<ChartFormType>,
      default: () => ({
        chartType: 'line',
        selectedYTypes: [],
        groupBySelectedTypes: [],
      }),
    },

    hasHeader: {
      type: Boolean,
      default: true,
    },
  })

  const isGroupByDisabled = ref(false)
  const isChartLoading = ref(false)
  const chartOptions = ref({})
  const seriesCount = ref(0)
  const chartHeight = ref('400px')

  const chartContainerRef = ref<HTMLElement>()
  const { width: containerWidth } = useElementSize(chartContainerRef)

  const { yOptions, hasChart, groupByOptions, chartForm, xOptions } = useDataChart(props.data)
  const triggerProps = { 'update-at-scroll': true }

  const { formatDateTime } = useDateTimeFormat()

  // Read CSS variable colors so the chart respects the app theme
  function getCssVar(name: string): string {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  }

  const generateSeries = (name: string, isGroup?: boolean, datasetIndex?: number) => {
    const series: SeriesType = {
      name,
      type: chartForm.chartType,
      smooth: false,
      encode: {
        x: chartForm.xAxisType.name,
        y: name,
        label: [name],
      },
      symbolSize: 5,
      datasetIndex: 1,
    }
    if (isGroup) {
      series.datasetIndex = datasetIndex
      series.encode.label = [name, chartForm.selectedYTypes[0]]
      series.encode.y = chartForm.selectedYTypes[0]
    }
    if (chartForm.chartType === 'line(smooth)') {
      series.type = 'line'
      series.smooth = true
      series.symbolSize = 0
    }
    return series
  }

  const getChartConfig = (yAxisTypes: string[]) => {
    const series: Array<SeriesType> = []
    const legendNames: Array<string> = []
    const dataset: Array<datasetType> = []
    if (chartForm.groupBySelectedTypes.length === 0) {
      dataset.push({
        dimensions: props.data.dimensionsAndXName.dimensions,
        source: props.data.records.rows,
      })
      dataset.push({
        transform: {
          type: 'sort',
          config: { dimension: chartForm.xAxisType.name, order: 'asc' },
        },
      })
      yAxisTypes.forEach((yAxisName: string) => {
        series.push(generateSeries(yAxisName))
        legendNames.push(yAxisName)
      })
      isChartLoading.value = false
    } else {
      const dataWithGroup = groupByToMap(props.data.records.rows, (value: any) => {
        let string = ``
        chartForm.groupBySelectedTypes.forEach((typeName: string, index: number) => {
          const typeIndex: number = groupByOptions.value.find(({ name }) => name === typeName)?.index ?? -1
          string = index === 0 ? `${value[typeIndex]}` : `${string}, ${value[typeIndex]}`
        })
        return string
      })
      seriesCount.value = dataWithGroup.size
      isChartLoading.value = seriesCount.value > 20
      let datasetIndex = -1
      dataWithGroup.forEach((groupResults: [][], key: string) => {
        legendNames.push(key)
        dataset.push({
          dimensions: props.data.dimensionsAndXName.dimensions,
          source: groupResults,
        })
        dataset.push({
          transform: {
            type: 'sort',
            config: { dimension: chartForm.xAxisType.name, order: 'asc' },
          },
          fromDatasetIndex: (datasetIndex += 1),
        })
        series.push(generateSeries(key, true, (datasetIndex += 1)))
      })
    }
    return { series, legendNames, dataset }
  }

  const makeOptions = () => {
    const { series, legendNames, dataset } = getChartConfig(chartForm.selectedYTypes)

    const dataType = chartForm.xAxisType.data_type

    const axisLabelColor = getCssVar('--small-font-color') || 'rgba(88,82,101,0.9)'
    const splitLineColor = getCssVar('--light-border-color') || 'rgba(23,12,44,0.08)'
    const axisLineColor = getCssVar('--border-color') || 'rgba(209,206,213,1)'

    const xAxis: any = {
      axisLine: { show: true, lineStyle: { color: axisLineColor } },
      axisTick: { show: false },
      axisLabel: { color: axisLabelColor, fontSize: 11 },
      splitLine: { show: false },
    }

    if (dataType !== 'TimestampMillisecond') {
      xAxis.axisLabel.formatter = (value: number) => formatDateTime(value, dataType) ?? String(value)
      xAxis.axisPointer = {
        label: { formatter: (p: any) => formatDateTime(p.value, dataType) ?? String(p.value) },
      }
      xAxis.min = (value: any) => value.min
    } else {
      xAxis.type = 'time'
      xAxis.axisLabel.formatter = (value: number) => formatDateTime(value, 'TimestampMillisecond') ?? String(value)
      xAxis.axisPointer = {
        label: { formatter: (p: any) => formatDateTime(p.value, 'TimestampMillisecond') ?? String(p.value) },
      }
    }

    // Legend sizing
    const width = containerWidth.value || 800
    const legendIconH = 12
    const legendIconW = 24
    const legendGap = 10
    const legendLineH = 16
    const charW = 6.8
    const totalLen =
      legendNames.join('').length * charW + legendIconW * legendNames.length + legendGap * (legendNames.length - 1)
    const legendRows = Math.max(1, Math.ceil(totalLen / (width - 40)))
    const legendH = legendRows * legendLineH + (legendRows - 1) * 6
    const gridBottom = legendH + 52 // space for legend + dataZoom
    const gridHeight = Math.max(260, Math.min(400, window.innerHeight * 0.38))
    chartHeight.value = `${gridBottom + gridHeight}px`

    return {
      legend: {
        data: legendNames,
        bottom: 38,
        height: legendH,
        itemGap: legendGap,
        itemWidth: legendIconW,
        itemHeight: legendIconH,
        borderWidth: 0,
        textStyle: {
          color: axisLabelColor,
          fontSize: 12,
          fontFamily: 'Google Sans Code, monospace',
        },
      },
      grid: {
        containLabel: true,
        left: 8,
        right: 16,
        top: 16,
        bottom: gridBottom,
      },
      dataZoom: [
        {
          type: 'inside',
          filterMode: 'none',
        },
        {
          type: 'slider',
          bottom: legendH + 4,
          height: 24,
          borderColor: axisLineColor,
          backgroundColor: 'transparent',
          dataBackground: {
            lineStyle: { color: axisLineColor, width: 1 },
            areaStyle: { color: splitLineColor },
          },
          selectedDataBackground: {
            lineStyle: { color: getCssVar('--brand-color') || '#8322ff', width: 1 },
            areaStyle: { color: getCssVar('--light-brand-color') || 'rgba(163,118,255,0.15)' },
          },
          fillerColor: getCssVar('--light-brand-color') || 'rgba(163,118,255,0.12)',
          handleStyle: { color: getCssVar('--brand-color') || '#8322ff' },
          moveHandleStyle: { color: getCssVar('--brand-color') || '#8322ff' },
          textStyle: { color: axisLabelColor, fontSize: 10 },
          brushSelect: false,
        },
      ],
      tooltip: {
        trigger: 'axis',
        appendToBody: true,
        backgroundColor: getCssVar('--tooltip-bg-color') || 'rgba(23,12,44,0.92)',
        borderColor: 'transparent',
        textStyle: { color: '#fff', fontSize: 12, fontFamily: 'Google Sans Code, monospace' },
        formatter: (params: any) => {
          if (!params?.length) return ''
          const timeValue = params[0].value[0] ?? params[0].axisValue
          const timeStr = formatDateTime(timeValue, dataType) ?? String(timeValue)
          let content = `<div style="margin-bottom:6px;font-weight:600;color:rgba(255,255,255,0.85)">${timeStr}</div>`
          params.forEach((p: any) => {
            const value = p.value[1] !== undefined ? p.value[1] : p.value
            if (value === null || value === undefined) return
            content += `<div style="display:flex;align-items:center;gap:6px;margin:3px 0">
              <span style="width:8px;height:8px;border-radius:50%;background:${p.color};flex-shrink:0"></span>
              <span style="color:rgba(255,255,255,0.7);flex:1">${p.seriesName}</span>
              <span style="font-weight:600;margin-left:12px">${value}</span>
            </div>`
          })
          return content
        },
      },
      dataset,
      xAxis,
      yAxis: {
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: axisLabelColor, fontSize: 11 },
        splitLine: { show: true, lineStyle: { color: splitLineColor, type: 'dashed' } },
        min: 'dataMin',
        max: 'dataMax',
      },
      series,
    }
  }

  const showChart = () => {
    isChartLoading.value = false
  }

  const drawChart = () => {
    chartOptions.value = makeOptions()
  }

  watchEffect(() => {
    if (chartForm.selectedYTypes.length !== 1) {
      isGroupByDisabled.value = true
      chartForm.groupBySelectedTypes = []
    } else {
      isGroupByDisabled.value = false
    }
  })

  watch(containerWidth, () => {
    drawChart()
  })

  watch(
    [chartForm, () => props],
    () => {
      drawChart()
    },
    { deep: true }
  )

  onMounted(() => {
    if (hasChart.value) {
      chartForm.chartType = props.defaultChartForm.chartType || 'line'
      chartForm.selectedYTypes = props.defaultChartForm.selectedYTypes?.length
        ? props.defaultChartForm.selectedYTypes
        : [yOptions.value[0]]
      chartForm.xAxisType = props.defaultChartForm.xAxisType?.name
        ? props.defaultChartForm.xAxisType
        : xOptions.value[0]
      if (props.defaultChartForm.groupBySelectedTypes?.length) {
        chartForm.groupBySelectedTypes = props.defaultChartForm.groupBySelectedTypes
      } else if (groupByOptions.value.length) {
        chartForm.groupBySelectedTypes = groupByOptions.value.map((item) => item.name)
      }
    }
  })

  defineExpose({ hasChart })
</script>

<style scoped lang="less">
  .chart-container {
    width: 100%;
  }

  .chart-form {
    margin-top: 12px;
    :deep(.arco-select-view-single) {
      min-width: 180px;
    }
    :deep(.arco-select-view-multiple.arco-select-view-size-medium) {
      font-size: 14px;
      min-width: 180px;
    }
    .arco-form-item-layout-inline {
      margin-right: 38px;
    }
  }
</style>
