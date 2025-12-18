import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import ExcelJS from 'exceljs'

export interface Document {
  id: string | number
  titre: string
  client: string
  risque: string
  typeCourrier: string
  date: string
  taille: string
  reference: string
}

// Export PDF
export function exporterPDF(documents: Document[], titre: string = 'Liste des documents') {
  const doc = new jsPDF()

  // En-tête
  doc.setFontSize(20)
  doc.setTextColor(211, 32, 39) // Rouge ACS
  doc.text('ACS - Assureurs Conseils Service', 105, 20, { align: 'center' })
  
  doc.setFontSize(14)
  doc.setTextColor(0, 0, 0)
  doc.text(titre, 105, 30, { align: 'center' })

  doc.setFontSize(10)
  doc.setTextColor(100, 100, 100)
  doc.text(`Généré le ${new Date().toLocaleDateString('fr-FR')}`, 105, 38, { align: 'center' })

  // Tableau
  autoTable(doc, {
    startY: 45,
    head: [['Référence', 'Titre', 'Client', 'Risque', 'Type', 'Date']],
    body: documents.map(d => [
      d.reference,
      d.titre,
      d.client,
      d.risque,
      d.typeCourrier === 'ACS_VERS_CLIENT' ? 'ACS → Client' : 'ACS → Compagnie',
      d.date
    ]),
    headStyles: {
      fillColor: [211, 32, 39],
      textColor: [255, 255, 255],
      fontSize: 10,
      fontStyle: 'bold'
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245]
    },
    margin: { top: 45 }
  })

  // Pied de page
  const pageCount = (doc as any).internal.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(150, 150, 150)
    doc.text(
      `Page ${i} sur ${pageCount}`,
      doc.internal.pageSize.getWidth() / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    )
  }

  // Téléchargement
  doc.save(`ACS_Documents_${new Date().toISOString().split('T')[0]}.pdf`)
}

// Export Excel
export async function exporterExcel(documents: Document[], nomFichier: string = 'documents') {
  // Créer le workbook
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'ACS Archive System'
  workbook.created = new Date()
  
  // Ajouter une feuille
  const worksheet = workbook.addWorksheet('Documents')

  // Définir les colonnes
  worksheet.columns = [
    { header: 'Référence', key: 'reference', width: 20 },
    { header: 'Titre', key: 'titre', width: 40 },
    { header: 'Client', key: 'client', width: 25 },
    { header: 'Risque', key: 'risque', width: 15 },
    { header: 'Type de courrier', key: 'typeCourrier', width: 20 },
    { header: 'Date', key: 'date', width: 12 },
    { header: 'Taille', key: 'taille', width: 10 },
  ]

  // Ajouter les données
  documents.forEach(d => {
    worksheet.addRow({
      reference: d.reference,
      titre: d.titre,
      client: d.client,
      risque: d.risque,
      typeCourrier: d.typeCourrier === 'ACS_VERS_CLIENT' ? 'ACS → Client' : 'ACS → Compagnie',
      date: d.date,
      taille: d.taille
    })
  })

  // Styliser l'en-tête
  const headerRow = worksheet.getRow(1)
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD32027' }
    }
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
  })

  // Générer le fichier et télécharger
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `ACS_${nomFichier}_${new Date().toISOString().split('T')[0]}.xlsx`
  link.click()
}

// Export CSV
export function exporterCSV(documents: Document[], nomFichier: string = 'documents') {
  const headers = ['Référence', 'Titre', 'Client', 'Risque', 'Type de courrier', 'Date', 'Taille']
  
  const csvContent = [
    headers.join(';'),
    ...documents.map(d => [
      d.reference,
      `"${d.titre}"`,
      d.client,
      d.risque,
      d.typeCourrier === 'ACS_VERS_CLIENT' ? 'ACS → Client' : 'ACS → Compagnie',
      d.date,
      d.taille
    ].join(';'))
  ].join('\n')

  // Ajouter BOM pour Excel
  const BOM = '\uFEFF'
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  
  link.setAttribute('href', url)
  link.setAttribute('download', `ACS_${nomFichier}_${new Date().toISOString().split('T')[0]}.csv`)
  link.style.visibility = 'hidden'
  
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}
