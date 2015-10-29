var highland = require('highland')
var request = require('request')
var cheerio = require('cheerio')
var ent = require('ent')
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
        id: response.request.href.split('CaseNo=')[1].replace(/%20/g, ' '),
        title: document('#ctl00_m_g_39b2e503_4cae_4c82_a505_66099a6ff48d_ctl00_lblCasetitle').text(),
        subject: document('.casedetailtbl td:not(.txtbold)').eq(0).text(),
        economicSector: document('.casedetailtbl td:not(.txtbold)').eq(1).text(),
        instrumentsInvoked: (document('#ctl00_m_g_39b2e503_4cae_4c82_a505_66099a6ff48d_ctl00_rptCasesList_ctl00_lblBIT').text() + ' ' + document('#ctl00_m_g_39b2e503_4cae_4c82_a505_66099a6ff48d_ctl00_rptCasesList_ctl00_lblInstrumentInvk').text()),
        applicableRules: document('.casedetailtbl td:not(.txtbold)').eq(3).text(),
        seatOfArbitration: document('.casedetailtbl td:not(.txtbold)').eq(4).text(),
        claimants: document('#ctl00_m_g_39b2e503_4cae_4c82_a505_66099a6ff48d_ctl00_rptCasesList_ctl00_rptProceeding_ctl00_Label5').text(),
        respondents: document('#ctl00_m_g_39b2e503_4cae_4c82_a505_66099a6ff48d_ctl00_rptCasesList_ctl00_rptProceeding_ctl00_Label1').text(),
        registeredDate: document('.casedetailtbl td:not(.txtbold)').eq(8).text(),
        constitutionOfTribunalDate: document('#ctl00_m_g_39b2e503_4cae_4c82_a505_66099a6ff48d_ctl00_rptCasesList_ctl00_rptProceeding_ctl00_lbldatconst').text(),
        tribunalPresident: document('#ctl00_m_g_39b2e503_4cae_4c82_a505_66099a6ff48d_ctl00_rptCasesList_ctl00_rptProceeding_ctl00_lblPresident').text(),
        tribunalArbitrators: document('.casedetailtbl td:not(.txtbold)').eq(12).html().trim().replace(/<br>$/, '').replace(/<br>/g, '; '),
        initialTribunalPresident: document('.casedetailtbl td:not(.txtbold)').eq(13).text(),
        initialTribunalArbitrators: document('.casedetailtbl td:not(.txtbold)').eq(14).html().trim().replace(/<br>$/, '').replace(/<br>/g, '; '),
        initialTribunalReconstituted: document('#ctl00_m_g_39b2e503_4cae_4c82_a505_66099a6ff48d_ctl00_rptCasesList_ctl00_rptProceeding_ctl00_lbldatreconst').text(),
        representitivesClaimants: document('.casedetailtbl td:not(.txtbold)').eq(16).find(':not(.txtbold)').html().trim().replace(/<br>$/, '').replace(/<br>/g, '; '),
        representitivesRespondents: document('.casedetailtbl td:not(.txtbold)').eq(17).find(':not(.txtbold)').html().trim().replace(/<br>$/, '').replace(/<br>/g, '; '),
        proceedingLanguage: document('#ctl00_m_g_39b2e503_4cae_4c82_a505_66099a6ff48d_ctl00_rptCasesList_ctl00_rptProceeding_ctl00_lblLang').text(),
        proceedingStatus: document('#ctl00_m_g_39b2e503_4cae_4c82_a505_66099a6ff48d_ctl00_rptCasesList_ctl00_rptProceeding_ctl00_lblSts').text(),
        proceedingOutcome: document('#ctl00_m_g_39b2e503_4cae_4c82_a505_66099a6ff48d_ctl00_rptCasesList_ctl00_rptProceeding_ctl00_lblOut').text()
    }
}

function decode(details) {
    for (key in details) {
        details[key] = ent.decode(details[key]).trim()
    }
    return details
}

highland([directory])
    .flatMap(http)
    .flatMap(cases)
    .flatMap(http)
    .map(details)
    .map(decode)
    .errors(function (e) { console.log('Error: ' + e.stack) })
    .through(csvWriter())
    .pipe(fs.createWriteStream('icsid.csv'))
