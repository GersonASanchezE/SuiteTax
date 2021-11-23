/**
 * @NApiVersion 2.x
 * @NScriptType MapReduceScript
 * @NModuleScope Public
 */
define(['N/log','N/record','N/search','N/format','N/runtime','./Latam_Library/LMRY_libSendingEmailsLBRY_V2.0', './WTH_Library/LMRY_BR_Massive_WHT_Purchase_LBRY','N/task'],

  function(log, record, search, format, runtime, libraryEmail, libraryPurchase,task) {

    var LMRY_script = 'LatamReady - BR WHT Purchase MPRD';

    var scriptObj = runtime.getCurrentScript();
    var userid = scriptObj.getParameter({name: 'custscript_lmry_br_wht_user'});
    var logid = scriptObj.getParameter({name: 'custscript_lmry_br_wht_state'});

    /**
     * Input Data for processing
     *
     * @return Array,Object,Search,File
     *
     * @since 2016.1
     */
    function getInputData() {

      try{

        log.error('userid y logid',userid + "-" + logid);

        var subsiLog = search.lookupFields({type:'customrecord_lmry_br_wht_purchase_log', id: logid, columns: ['custrecord_lmry_br_wht_log_subsi']});
        subsiLog = subsiLog.custrecord_lmry_br_wht_log_subsi[0].value;

        libraryPurchase.setupTaxSubsidiary(subsiLog);
        libraryPurchase.whtStandard(subsiLog);
        libraryPurchase.setLog(logid, userid);

        var jsonPayment = libraryPurchase.iteracionBill();

        log.error('jsonPayment',jsonPayment);

        return jsonPayment;

      }catch(err){
        record.submitFields({type:'customrecord_lmry_br_wht_purchase_log',id:logid, values:{custrecord_lmry_br_wht_log_state:'Ocurrio un error'}, options: {ignoreMandatoryFields: true, disableTriggers: true} });
        log.error('[getInputData]',err);
        libraryEmail.sendemail('[ getInputData ] ' + err, LMRY_script);
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
        currentLog = JSON.parse(currentLog[0]);

        var idLog = context.key;

        libraryPurchase.creadoTransacciones(currentLog, idLog);

        /*var remainingUsage1 = runtime.getCurrentScript().getRemainingUsage();
        log.error('Memoria consumida', remainingUsage1);*/

      }catch(err){
        log.error('Reduce',err);
        record.submitFields({type:'customrecord_lmry_br_wht_purchase_log',id: idLog, values:{custrecord_lmry_br_wht_log_state: 'Ocurrio un error'}, options: {ignoreMandatoryFields: true, disableTriggers: true}});
        libraryEmail.sendemail('[reduce]' + err, LMRY_script);
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

      updatePayment();

      executeBatchPayment();
    }

  /*--------------------------------------------------------------------------------
      July 6, 2020 (Richard Galvez)
      - updatePayment()
        actualiza la relacion del pago con respecto a un archivo de transferencia

      - executeBatchPayment()
        la siguiente funcion ejecuta un scheduled el cual actualiza
        el pago, verificando si este pertenece o no a un transer file. En caso no este
        instalado el bundle Electronic Bank Payments by LatamReady, no hara nada.
    --------------------------------------------------------------------------------*/

      function updatePayment(){

        try{

          if(logid){

            var recordType = 'customrecord_lmry_br_wht_purchase_log';

            var _WHT = record.load({type:recordType,id:logid});

            var _PAYMENT = _WHT.getValue('custrecord_lmry_br_wht_log_payment');

            log.error('payment',_PAYMENT);

            if(_PAYMENT)
            {

              var epay = '';
              search.create({
                type: 'customrecord_lmry_e_batch_rcd',
                columns : ['custrecord_lmry_batch_tf'],
                filters: [
                  ['custrecord_lmry_batch_rcd','is',recordType]
                  ,'and'
                  ,['custrecord_lmry_batch_internalid','is',logid]
                ]
              }).run().each(function(line){
                epay = line.getValue('custrecord_lmry_batch_tf');
                return false;
              });

              log.error('epay',epay);

              if(epay){
                record.submitFields(
                  {type:'vendorpayment',
                  id: _PAYMENT,
                  values:{
                    custbody_lmry_epay_tranfer_file:epay,
                  },
                  options: {ignoreMandatoryFields:true, disableTriggers: true}
                  });

              }

            }



          }

        }catch(err){
          log.error('err',err);
          log.error('E. Payment (udpatePayment)','It do not found');
        }

      }

      function executeBatchPayment(){

        try{

          var wht_br_log_id = '';
          var wht_br_log_entity = '';
          search.create({
            type: 'customrecord_lmry_br_wht_purchase_log',
            columns: [{
              name: 'internalid',
              sort: search.Sort.ASC
            }, {
              name: 'custrecord_lmry_br_wht_log_employee'
            }],
            filters: [
              ['custrecord_lmry_br_wht_log_state', 'is', 'Preview (EBP)']
            ]
          }).run().each(function(line) {
            wht_br_log_id = line.getValue('internalid');
            wht_br_log_entity = line.getValue('custrecord_lmry_br_wht_log_employee');
          });

          if (wht_br_log_id) {

            task.create({
              taskType: task.TaskType.MAP_REDUCE,
              scriptId: 'customscript_lmry_br_wht_purchase_mprd',
              deploymentId: 'customdeploy_lmry_br_wht_purchase_mprd',
              params: {
                'custscript_lmry_br_wht_user': wht_br_log_entity,
                'custscript_lmry_br_wht_state': wht_br_log_id
              }
            }).submit();

          }

        }catch(err){
          log.error('E. Payment (executeBatchPayment)',err);
        }

      }

    /*-------------------------------------------------------------------------------*/


    return {
      getInputData: getInputData,
      //map: map,
      reduce: reduce,
      summarize: summarize
    };

  });
