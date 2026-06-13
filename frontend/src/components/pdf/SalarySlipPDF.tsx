import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import type { SalaryRecord } from '../../hooks/useSalary'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

const s = StyleSheet.create({
  page:    { padding: 32, fontFamily: 'Helvetica', fontSize: 10, color: '#1A1D23' },
  header:  { marginBottom: 20 },
  title:   { fontSize: 18, fontWeight: 'bold', color: '#5D78FF', marginBottom: 4 },
  subtitle:{ fontSize: 11, color: '#6B7280' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 11, fontWeight: 'bold', color: '#374151', marginBottom: 8, borderBottom: '1 solid #E8E9F0', paddingBottom: 4 },
  row:     { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  label:   { color: '#6B7280' },
  value:   { fontWeight: 'bold' },
  netRow:  { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, padding: '8 12', backgroundColor: '#EDE9FE', borderRadius: 6 },
  netLabel:{ fontSize: 12, fontWeight: 'bold', color: '#7C3AED' },
  netValue:{ fontSize: 14, fontWeight: 'bold', color: '#7C3AED' },
  infoGrid:{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
  infoItem:{ width: '45%' },
  infoLabel:{ color: '#8A8FA8', fontSize: 9 },
  infoValue:{ color: '#1A1D23', fontWeight: 'bold', marginTop: 2 },
})

function fmt(n: number) { return `₹${n.toLocaleString('en-IN')}` }

interface Props {
  record: SalaryRecord
  employeeName: string
  designation?: string
}

export default function SalarySlipPDF({ record, employeeName, designation }: Props) {
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <Text style={s.title}>ASPCV — Salary Slip</Text>
          <Text style={s.subtitle}>Aspiration Cleantech Ventures Pvt Ltd</Text>
          <Text style={s.subtitle}>{MONTHS[record.month - 1]} {record.year}</Text>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Employee Details</Text>
          <View style={s.infoGrid}>
            <View style={s.infoItem}><Text style={s.infoLabel}>Name</Text><Text style={s.infoValue}>{employeeName}</Text></View>
            {designation && <View style={s.infoItem}><Text style={s.infoLabel}>Designation</Text><Text style={s.infoValue}>{designation}</Text></View>}
            <View style={s.infoItem}><Text style={s.infoLabel}>Month</Text><Text style={s.infoValue}>{MONTHS[record.month - 1]} {record.year}</Text></View>
            <View style={s.infoItem}><Text style={s.infoLabel}>Days Present</Text><Text style={s.infoValue}>{record.daysPresent}</Text></View>
            <View style={s.infoItem}><Text style={s.infoLabel}>Days Absent</Text><Text style={s.infoValue}>{record.daysAbsent}</Text></View>
            <View style={s.infoItem}><Text style={s.infoLabel}>Late Days</Text><Text style={s.infoValue}>{record.lateDays}</Text></View>
          </View>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Earnings</Text>
          <View style={s.row}><Text style={s.label}>Basic Salary</Text><Text style={s.value}>{fmt(record.baseSalary)}</Text></View>
          <View style={s.row}><Text style={s.label}>HRA</Text><Text style={s.value}>{fmt(record.hra)}</Text></View>
          <View style={s.row}><Text style={s.label}>Allowances</Text><Text style={s.value}>{fmt(record.allowances)}</Text></View>
          <View style={{ ...s.row, borderTop: '1 solid #E8E9F0', paddingTop: 4, marginTop: 4 }}>
            <Text style={{ ...s.label, fontWeight: 'bold' }}>Gross Salary</Text>
            <Text style={{ ...s.value, fontSize: 11 }}>{fmt(record.grossSalary)}</Text>
          </View>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Deductions</Text>
          <View style={s.row}><Text style={s.label}>PF (Employee 12%)</Text><Text style={s.value}>{fmt(record.pfEmployee)}</Text></View>
          <View style={s.row}><Text style={s.label}>ESI (Employee 0.75%)</Text><Text style={s.value}>{fmt(record.esiEmployee)}</Text></View>
          <View style={s.row}><Text style={s.label}>TDS</Text><Text style={s.value}>{fmt(record.tds)}</Text></View>
          {record.lateDeduction > 0 && <View style={s.row}><Text style={s.label}>Late Deduction ({record.fullDayCuts > 0 ? `${record.fullDayCuts} full day` : ''}{record.halfDayCuts > 0 ? ` ${record.halfDayCuts} half day` : ''})</Text><Text style={s.value}>{fmt(record.lateDeduction)}</Text></View>}
          {record.otherDeduction > 0 && <View style={s.row}><Text style={s.label}>Other Deductions</Text><Text style={s.value}>{fmt(record.otherDeduction)}</Text></View>}
        </View>

        <View style={s.netRow}>
          <Text style={s.netLabel}>Net Salary</Text>
          <Text style={s.netValue}>{fmt(record.netSalary)}</Text>
        </View>

        <View style={{ marginTop: 24, color: '#8A8FA8', fontSize: 9 }}>
          <Text>Employer PF Contribution: {fmt(record.pfEmployer)} | Employer ESI: {fmt(record.esiEmployer)}</Text>
          <Text style={{ marginTop: 4 }}>This is a computer generated salary slip.</Text>
        </View>
      </Page>
    </Document>
  )
}
