var highland = require('highland')
var request = require('request')
var cheerio = require('cheerio')
var fs = require('fs')
var csvWriter = require('csv-write-stream')

var http = highland.wrapCallback(function (location, callback) {
    request.defaults({ rejectUnauthorized: false })(location, function (error, response) {
        var failure = error ? error : (response.statusCode >= 400) ? new Error(response.statusCode) : null
        callback(failure, response)
    })
})

var directory = 'https://icsid.worldbank.org/apps/ICSIDWEB/cases/Pages/AdvancedSearch.aspx'

function cases(response) {
    var document = cheerio.load(response.body)
    var numbers  = document('#ctl00_m_g_ba040fcb_44f7_44fa_92d0_d088c5679794_ctl00_hfCaseNo').val().split(',')
    return numbers.map(number => 'https://icsid.worldbank.org/apps/ICSIDWEB/cases/Pages/casedetail.aspx?CaseNo=' + number)
}

function details(response) {
    var document = cheerio.load(response.body)
    return {
        page: response.request.href,
        title: document('#ctl00_m_g_39b2e503_4cae_4c82_a505_66099a6ff48d_ctl00_lblCasetitle').text().trim(),
        subject: document('.casedetailtbl td:not(.txtbold)').eq(0).text().trim(),
        economicSector: document('.casedetailtbl td:not(.txtbold)').eq(1).text().trim(),
        instrumentsInvoked: (document('#ctl00_m_g_39b2e503_4cae_4c82_a505_66099a6ff48d_ctl00_rptCasesList_ctl00_lblBIT').text().trim() + ' ' + document('#ctl00_m_g_39b2e503_4cae_4c82_a505_66099a6ff48d_ctl00_rptCasesList_ctl00_lblInstrumentInvk').text().trim()).trim(),
        applicableRules: document('.casedetailtbl td:not(.txtbold)').eq(3).text().trim(),
        claimants: document('#ctl00_m_g_39b2e503_4cae_4c82_a505_66099a6ff48d_ctl00_rptCasesList_ctl00_rptProceeding_ctl00_Label5').text().trim(),
        respondents: document('#ctl00_m_g_39b2e503_4cae_4c82_a505_66099a6ff48d_ctl00_rptCasesList_ctl00_rptProceeding_ctl00_Label1').text().trim(),
        registeredDate: new Date(document('.casedetailtbl td:not(.txtbold)').eq(8).text().trim()).toISOString(),
        constitutionOfTribunalDate: new Date(document('#ctl00_m_g_39b2e503_4cae_4c82_a505_66099a6ff48d_ctl00_rptCasesList_ctl00_rptProceeding_ctl00_lbldatconst').text().trim()).toISOString(),
        tribunalPresident: document('#ctl00_m_g_39b2e503_4cae_4c82_a505_66099a6ff48d_ctl00_rptCasesList_ctl00_rptProceeding_ctl00_lblPresident').text().trim(),
        tribunalArbitrators: document('.casedetailtbl td:not(.txtbold)').eq(12).text().trim(), // todo add commas
        initialTribunalPresident: document('.casedetailtbl td:not(.txtbold)').eq(13).text().trim(),
        initialTribunalArbitrators: document('.casedetailtbl td:not(.txtbold)').eq(14).text().trim(), // todo add commas
        initialTribunalReconstituted: document('#ctl00_m_g_39b2e503_4cae_4c82_a505_66099a6ff48d_ctl00_rptCasesList_ctl00_rptProceeding_ctl00_lbldatreconst').text().trim(),
        representitivesClaimants: document('.casedetailtbl td:not(.txtbold)').eq(16).text().trim(), // todo replace prefix, add commas
        representitivesRespondents: document('.casedetailtbl td:not(.txtbold)').eq(17).text().trim(), // todo replace prefix, add commas
        proceedingLanguage: document('#ctl00_m_g_39b2e503_4cae_4c82_a505_66099a6ff48d_ctl00_rptCasesList_ctl00_rptProceeding_ctl00_lblLang').text().trim(),
        proceedingStatus: document('#ctl00_m_g_39b2e503_4cae_4c82_a505_66099a6ff48d_ctl00_rptCasesList_ctl00_rptProceeding_ctl00_lblSts').text().trim(),
        proceedingOutcome: document('#ctl00_m_g_39b2e503_4cae_4c82_a505_66099a6ff48d_ctl00_rptCasesList_ctl00_rptProceeding_ctl00_lblOut').text().trim()
    }
}

highland([directory])
    .flatMap(http)
    .flatMap(cases)
    .flatMap(http)
    .map(details)
    .errors(function (e) { console.log('Error: ' + e.stack) })
    .through(csvWriter())
    .pipe(fs.createWriteStream('icsid.csv'))
