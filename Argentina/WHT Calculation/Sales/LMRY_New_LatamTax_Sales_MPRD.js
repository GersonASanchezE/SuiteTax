/* = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =\
||   This script for customer center (Time)                     ||
||                                                              ||
||  File Name: LMRY_New_LatamTax_Sales_MPRD.js  				        ||
||                                                              ||
||  Version Date         Author        Remarks                  ||
||  2.0     Oct 27 2020  LatamReady    Use Script 2.0           ||
 \= = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = */
/**
 * @NApiVersion 2.0
 * @NScriptType MapReduceScript
 * @NModuleScope Public
 */
define(['N/log','N/record','N/search','N/format','N/runtime','./WTH_Library/LMRY_New_LatamTax_Sales_LBRY','./Latam_Library/LMRY_libSendingEmailsLBRY_V2.0'],

  function(log,record,search,format,runtime, librarySales, libraryEmail) {

    var LMRY_script = 'LatamReady - New LatamTax Sales MPRD';

    var scriptObj = runtime.getCurrentScript();
    var idUser = scriptObj.getParameter({name: 'custscript_lmry_new_latamtax_user'});
    var idLog = scriptObj.getParameter({name: 'custscript_lmry_new_latamtax_state'});

    /**
     * Input Data for processing
     *
     * @return Array,Object,Search,File
     *
     * @since 2016.1
     */
    function getInputData() {

      try{
        log.debug('idUser y idLog',idUser + "-" + idLog);

        record.submitFields({type: 'customrecord_lmry_new_latamtax_sales_log', id: idLog,values: {custrecord_lmry_new_latamtax_employee: idUser, custrecord_lmry_new_latamtax_status: 'Procesando'} });

        return search.create({type: 'customrecord_lmry_new_latamtax_sales_log', filters: [{name: 'internalid', operator: 'is', values: idLog}], columns: ['custrecord_lmry_new_latamtax_subsidiary','custrecord_lmry_new_latamtax_customer','custrecord_lmry_new_latamtax_currency',
        'custrecord_lmry_new_latamtax_multibook','custrecord_lmry_new_latamtax_rate','custrecord_lmry_new_latamtax_date','custrecord_lmry_new_latamtax_period','custrecord_lmry_new_latamtax_invoices','custrecord_lmry_new_latamtax_method','custrecord_lmry_new_latamtax_araccount',
        'custrecord_lmry_new_latamtax_bank','custrecord_lmry_new_latamtax_memo','custrecord_lmry_new_latamtax_department','custrecord_lmry_new_latamtax_class','custrecord_lmry_new_latamtax_location','custrecord_lmry_new_latamtax_check','custrecord_lmry_new_latamtax_noretention',
        'custrecord_lmry_new_latamtax_edited']});

      }catch(err){
        libraryEmail.sendemail('[getInputData]' + err, LMRY_script);
        log.error('[getInputData]',err);
      }

    }

    /**
     * If this entry point is used, the map function is invoked one time for each key/value.
     *
     * @param {Object} context
     * @param {boolean} context.isRestarted - Indicates whether the current invocation represents a restart
     * @param {number} context.executionNo - Version of the bundle being installed
     * @param {Iterator} context.errors - This param contains a "iterator().each(parameters)" function
     * @param {string} context.key - The key to be processed during the current invocation
     * @param {string} context.value - The value to be processed during the current invocation
     * @param {function} context.write - This data is passed to the reduce stage
     *
     * @since 2016.1
     */
    function map(context) {

      try{

        var currentLog = context.value;
        currentLog = JSON.parse(currentLog);
        currentLog = currentLog.values;

        log.debug('currentLog',currentLog);

        var subsidiary = currentLog['custrecord_lmry_new_latamtax_subsidiary']['value'];
        var customer = currentLog['custrecord_lmry_new_latamtax_customer']['value'];
        var currency = currentLog['custrecord_lmry_new_latamtax_currency']['value'];
        var multibook = currentLog['custrecord_lmry_new_latamtax_multibook'];
        var rate = currentLog['custrecord_lmry_new_latamtax_rate'];
        var date = currentLog['custrecord_lmry_new_latamtax_date'];
        var accountingPeriod = currentLog['custrecord_lmry_new_latamtax_period']['value'];
        var invoices = currentLog['custrecord_lmry_new_latamtax_invoices'];

        librarySales.setupTaxSubsidiary(subsidiary);
        librarySales.multibooking(currency, multibook, rate);

        librarySales.getAccumulated(customer, 0, accountingPeriod, subsidiary, date);
        librarySales.ccynt(customer, date, subsidiary);

        var inv = [];
        var auxInvoice = JSON.parse(invoices);
        for(var i in auxInvoice){
          inv.push(i);
        }

        librarySales.basesAllInvoice(inv);

        //FUNCIONES X ITERACION
        librarySales.getSalesLog(currentLog , 1);
        librarySales.creditMemo(customer);
        librarySales.retencion(customer);
        librarySales.creadoTransacciones(idLog);

        record.submitFields({type: 'customrecord_lmry_new_latamtax_sales_log', id: idLog,values: {custrecord_lmry_new_latamtax_status: 'Finalizado'} });

        var remainingUsage1 = runtime.getCurrentScript().getRemainingUsage();
        log.debug('Memoria consumida', remainingUsage1);

      }catch(err){
        log.error('[map]',err);
        record.submitFields({type: 'customrecord_lmry_new_latamtax_sales_log',id: idLog,values: {custrecord_lmry_new_latamtax_status:'Ocurrio un error'}});
        libraryEmail.sendemail('[map]' + err, LMRY_script);
      }



    }

    /**
     * If this entry point is used, the reduce function is invoked one time for
     * each key and list of values provided..
     *
     * @param {Object} context
     * @param {boolean} context.isRestarted - Indicates whether the current invocation represents a restart
     * @param {number} context.executionNo - Version of the bundle being installed
     * @param {Iterator} context.errors - This param contains a "iterator().each(parameters)" function
     * @param {string} context.key - The key to be processed during the current invocation
     * @param {string} context.value - The value to be processed during the current invocation
     * @param {function} context.write - This data is passed to the reduce stage
     *
     * @since 2016.1
     */
    function reduce(context) {

    }

    /**
     * If this entry point is used, the reduce function is invoked one time for
     * each key and list of values provided..
     *
     * @param {Object} context
     * @param {boolean} context.isRestarted - Indicates whether the current invocation of the represents a restart.
     * @param {number} context.concurrency - The maximum concurrency number when running the map/reduce script.
     * @param {Date} context.datecreated - The time and day when the script began running.
     * @param {number} context.seconds - The total number of seconds that elapsed during the processing of the script.
     * @param {number} context.usage - TThe total number of usage units consumed during the processing of the script.
     * @param {number} context.yields - The total number of yields that occurred during the processing of the script.
     * @param {Object} context.inputSummary - Object that contains data about the input stage.
     * @param {Object} context.mapSummary - Object that contains data about the map stage.
     * @param {Object} context.reduceSummary - Object that contains data about the reduce stage.
     * @param {Iterator} context.ouput - This param contains a "iterator().each(parameters)" function
     *
     * @since 2016.1
     */
    function summarize(context) {

    }

    return {
      getInputData: getInputData,
      map: map
      //reduce: reduce
      //summarize: summarize
    };

  });
