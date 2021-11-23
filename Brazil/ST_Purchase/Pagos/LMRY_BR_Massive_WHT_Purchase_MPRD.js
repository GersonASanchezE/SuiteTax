/* = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =\
||   This script for customer center (Time)                     ||
||                                                              ||
||  File Name: LMRY_BR_Massive_WHT_Purchase_MPRD.js  				    ||
||                                                              ||
||  Version Date         Author        Remarks                  ||
||  2.0     Nov 09 2020  LatamReady    Use Script 2.0           ||
 \= = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = */
/**
 * @NApiVersion 2.x
 * @NScriptType MapReduceScript
 * @NModuleScope Public
 */
define(['N/log', 'N/record', 'N/search', 'N/format', 'N/runtime', './Latam_Library/LMRY_libSendingEmailsLBRY_V2.0', './WTH_Library/LMRY_BR_Massive_WHT_Purchase_LBRY'],

  function(log, record, search, format, runtime, libraryEmail, libraryPurchase) {

    var LMRY_script = 'LatamReady - BR Massive WHT Purch MPRD';

    var scriptObj = runtime.getCurrentScript();
    var idUser = scriptObj.getParameter({name: 'custscript_lmry_br_massive_wht_user'});
    var idLog = scriptObj.getParameter({name: 'custscript_lmry_br_massive_wht_state'});

    /**
     * Input Data for processing
     *
     * @return Array,Object,Search,File
     *
     * @since 2016.1
     */
    function getInputData() {

      try{

        log.error('idUser y idLog',idUser + "-" + idLog);

        idLog = idLog.split('|');

        var subsiLog = search.lookupFields({type:'customrecord_lmry_br_wht_purchase_log', id: idLog[0], columns: ['custrecord_lmry_br_wht_log_subsi']});
        subsiLog = subsiLog.custrecord_lmry_br_wht_log_subsi[0].value;

        libraryPurchase.setupTaxSubsidiary(subsiLog);
        libraryPurchase.whtStandard(subsiLog);

        var jsonPayment = {};

        for(var i = 0; i < idLog.length - 1; i++){
          libraryPurchase.setLog(idLog[i], idUser);
          jsonPayment = libraryPurchase.iteracionBill();
        }

        log.error('jsonPayment',jsonPayment);

        return jsonPayment;

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

      try{

        var currentLog = context.values;
        var idLog = context.key;

        currentLog = JSON.parse(currentLog[0]);

        libraryPurchase.creadoTransacciones(currentLog, context.key);

        /*var remainingUsage1 = runtime.getCurrentScript().getRemainingUsage();
        log.error('Memoria consumida', remainingUsage1);*/

      }catch(error){
        log.error('reduce',error);
        record.submitFields({type:'customrecord_lmry_br_wht_purchase_log',id: idLog, values:{custrecord_lmry_br_wht_log_state: 'Ocurrio un error'}, options: {disableTriggers: true, ignoreMandatoryFields: true}});
        libraryEmail.sendemail('[reduce]' + error, LMRY_script);
      }

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
      //map: map
      reduce: reduce
      //summarize: summarize
    };

  });
