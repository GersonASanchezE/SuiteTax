  /**
 * @NApiVersion 2.0
 * @NModuleScope Public
 */

/* = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =\
||   This script for customer center (Time)                     ||
||                                                              ||
||  File Name: LMRY_AR_ST_Perception_LBRY_V2.0.js		            ||
||                                                              ||
||  Version Date         Author        Remarks                  ||
||  2.0     Sep 13 2021  LatamReady    Use Script 2.0           ||
 \= = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = */

 define(["N/log", "N/record", "N/search", "N/runtime", "./LMRY_libSendingEmailsLBRY_V2.0", './LMRY_Log_LBRY_V2.0'
],

function (log, record, search, runtime, library, Library_Log) {

  var LMRY_script = "LatamReady - AR ST Purchases Perception LBRY";
  var LMRY_SCRIPT_NAME = 'LMRY_AR_ST_Purchases_Perception_LBRY_V2.0.js';

  var FEATURE_DEPARTMENT = runtime.isFeatureInEffect({ feature: "DEPARTMENTS" });
  var FEATURE_CLASSES = runtime.isFeatureInEffect({ feature: "CLASSES" });
  var FEATURE_LOCATIONS = runtime.isFeatureInEffect({ feature: "LOCATIONS" });

  // Accounting Preferences
  var userObj = runtime.getCurrentUser();
  var MANDATORY_DEPARTMENT = userObj.getPreference({ name: "DEPTMANDATORY" });
  var MANDATORY_LOCATION = userObj.getPreference({ name: "LOCMANDATORY" });
  var MANDATORY_CLASS = userObj.getPreference({ name: "CLASSMANDATORY" });

  var FEATURE_SUBSIDIARIES = runtime.isFeatureInEffect({ feature: "SUBSIDIARIES" });
  var FEATURE_MULTIBOOK = runtime.isFeatureInEffect({ feature: "MULTIBOOK" });
  var USER = runtime.getCurrentUser();

  var exchange_global = 1;
  var numLines = 1;
  var filtroTransactionType = "";
  // var cantidad = 0;

  /*********************************************************************************************************
   * Funcion que realiza el calculo de los impuestos.
   * Para Peru: Llamada desde el User Event del Invoice, Credit Memo.
   ********************************************************************************************************/
  function applyPerception(context){
    try {
      
      var operationType = context.type;
      var id = context.newRecord.id;
      var type = context.newRecord.type;

      switch (type) {
        case "vendorbill": filtroTransactionType = 4; break;
        case "vendorcredit": filtroTransactionType = 7; break;
      }

      var recordObj = record.load({
        type: type,
        id: id,
        isDynamic: true
      });

      var override = recordObj.getValue('taxdetailsoverride');
      if (override == false || override == 'F'){
        return true;
      }
      // log.error("recordObj", recordObj);
      // var recordObj = scriptContext.newRecord;



      // numLines = recordObj.getLineCount('item');
      // var auto_wht = recordObj.getValue('custbody_lmry_apply_wht_code');
      var legalDocType = recordObj.getValue("custbody_lmry_document_type");
      var fieldStatus = recordObj.getField({fieldId: 'custbody_psg_ei_status'});
      var eDocStatus = '';
      if (fieldStatus != '' && fieldStatus != null) {
        eDocStatus = recordObj.getValue("custbody_psg_ei_status");
        if (eDocStatus != null && eDocStatus != '') {
          eDocStatus = search.lookupFields({ type: 'customlist_psg_ei_status', id: eDocStatus, columns: ['name'] });
          eDocStatus = eDocStatus.name;
        }
      }

      if (validarTipoDoc(legalDocType) && (eDocStatus != "Sent" && eDocStatus != "Enviado")) {
        var transactionDate = recordObj.getText("trandate");
        var entity = recordObj.getValue("entity");

        // Verifica si esta activo el Feature Proyectos
        var featjobs = runtime.isFeatureInEffect({feature: "JOBS"});
        if (featjobs == true) {
            var ajobs = search.lookupFields({ type: search.Type.JOB, id: entity, columns: ['customer'] });
                if (ajobs.customer) {
                    entity = ajobs.customer[0].value;
                }
        }
        var subsidiary = recordObj.getValue("subsidiary");
        var responsableType = search.lookupFields({ type: search.Type.VENDOR, id: entity, columns: ['custentity_lmry_ar_tiporespons'] }); 
        // Se valida que el campo no este vacio
        if (responsableType.custentity_lmry_ar_tiporespons.length == 0 || responsableType == '' || responsableType == null) {
          return true;
        }
        var RespType = responsableType.custentity_lmry_ar_tiporespons[0].value;

        var setupSubsidiary = getSetupTaxSubsidiary(subsidiary);
        var tipoRedondeo = setupSubsidiary["rounding"];
        var apply_line = setupSubsidiary["applyLine"];
        var setup_department = setupSubsidiary["dapartment"];
        var setup_class = setupSubsidiary["class"];
        var setup_location = setupSubsidiary["location"];
        var arregloSegmentacion = [setup_department, setup_class, setup_location];
        exchange_global = getExchangeRate(recordObj, subsidiary, setupSubsidiary);

        var searchResultCC = getContributoryClasses(subsidiary, transactionDate, filtroTransactionType, entity, legalDocType, RespType);
        var searchResultNT = getNationalTaxes(subsidiary, transactionDate, filtroTransactionType, legalDocType, RespType);
        // log.error("searchResultCC21", searchResultCC)
        // log.error("searchResultNT21", searchResultNT)
        
        // if (operationType != "create" ) {
          deleteTaxItemLines(recordObj);
        // }

        numLines = recordObj.getLineCount('item');
        addItem(searchResultCC, recordObj, tipoRedondeo, arregloSegmentacion);
        addItem(searchResultNT, recordObj, tipoRedondeo, arregloSegmentacion);

        recordObj.save({ ignoreMandatoryFields: true, disableTriggers: true, enableSourcing: true });
       
      }
    }
    catch (err) {
      log.error("Error applyPerception", err);
      library.sendemail(' [ After Submit - applyPerception] ' + err, LMRY_script);
      Library_Log.doLog({ title: '[ After Sumbit - applyPerception ]', message: err, relatedScript: LMRY_SCRIPT_NAME });
    }
  }

  /**************************************************************
   * Validar si el tipo de documento de la transaccion se
   * encuentra en el registro personalizado
   *    - tipoDoc: Tipo de docuemnto legal de la transaccion
   *********************************************************** */
  function validarTipoDoc(tipoDoc) {
    try {
      var tipoDocEncontrado = false;

      if (tipoDoc == '' || tipoDoc == null) {
        return tipoDocEncontrado;
      }

      var busqDocTypePerc = search.create({
        type: 'customrecord_lmry_ar_doctype_percep',
        columns: ['custrecord_lmry_ar_doctype_percep'],
        filters: [['custrecord_lmry_ar_doctype_percep', 'anyof', tipoDoc]]
      });

      var resultDocTypePerc = busqDocTypePerc.run().getRange(0, 1);
      if (resultDocTypePerc != null && resultDocTypePerc.length != 0) {
        tipoDocEncontrado = true;
      }
      return tipoDocEncontrado;
    } catch (err) {
      // Envio de mail con errores
      log.error("[ applyPerception - validarTipoDoc ]", err);
      LibraryMail.sendemail('[ applyPerception - validarTipoDoc ] ' + err, Name_script);
      Library_Log.doLog({ title: '[ applyPerception - validarTipoDoc ]', message: err, relatedScript: LMRY_SCRIPT_NAME });
    }
  }

  /**************************************************************
   * Verifica si en la lineas (item) esta marcado el campo
   * personalizado.
   *    - recordObj: Objeto record
   *    - numLines: Numero de lineas de item
   *************************************************************/
  function contieneTributo(recordObj, numLines) {
    try {
      var tributo = false;
      for (var i = 0; i < numLines; i++) {
        var tiene_tributo = recordObj.getSublistValue('item', 'custcol_lmry_ar_item_tributo', i);
        var perception_percentage = recordObj.getSublistValue('item', 'custcol_lmry_ar_perception_percentage', i);
        if (tiene_tributo == true && (perception_percentage != null && perception_percentage != '')) {
          tributo = true;
        }
      }
      return tributo;
    }
    catch (e) {
      log.error("[ applyPerception - contieneTributo ]", e);
      LibraryMail.sendemail('[ applyPerception - contieneTributo ] ' + e, Name_script);
      Library_Log.doLog({ title: '[ applyPerception - contieneTributo ]', message: e, relatedScript: LMRY_SCRIPT_NAME });
    }
  }

  /**********************************************************
  * Busqueda en el record: LatamReady - Setup Tax Subsidiary
  *    - subsidiary: Subsidiaria
  **********************************************************/
  function getSetupTaxSubsidiary(subsidiary) {
    try{
      var featureSubs = runtime.isFeatureInEffect({
        feature: "SUBSIDIARIES",
      });
      var filters = [
        ['isinactive', 'is', 'F'], 'AND'
      ];
      if (featureSubs == true || featureSubs == 'T') {
        filters.push(['custrecord_lmry_setuptax_subsidiary', 'anyof', subsidiary]);
      }

      var search_setupSub = search.create({
        type: 'customrecord_lmry_setup_tax_subsidiary',
        filters: filters,
        columns: ['custrecord_lmry_setuptax_currency', 'custrecord_lmry_setuptax_depclassloc', 'custrecord_lmry_setuptax_type_rounding', 'custrecord_lmry_setuptax_department', 'custrecord_lmry_setuptax_class','custrecord_lmry_setuptax_location', 'custrecord_lmry_setuptax_apply_line']
      });

      var results = search_setupSub.run().getRange(0, 1);

      var setupSubsidiary = {};

      if (results && results.length > 0) {
        setupSubsidiary['isDefaultClassification'] = results[0].getValue('custrecord_lmry_setuptax_depclassloc');
        setupSubsidiary['rounding'] = results[0].getValue('custrecord_lmry_setuptax_type_rounding');
        setupSubsidiary['department'] = results[0].getValue('custrecord_lmry_setuptax_department');
        setupSubsidiary['class'] = results[0].getValue('custrecord_lmry_setuptax_class');
        setupSubsidiary['location'] = results[0].getValue('custrecord_lmry_setuptax_location');
        setupSubsidiary['currency'] = results[0].getValue('custrecord_lmry_setuptax_currency');
        setupSubsidiary['applyLine'] = results[0].getValue('custrecord_lmry_setuptax_apply_line');
      }
      return setupSubsidiary;
    }
    catch(e){
      log.error("[ applyPerception - getSetupTaxSubsidiary ]", e);
      library.sendemail(' [ applyPerception - getSetupTaxSubsidiary] ' + e, LMRY_script);
      Library_Log.doLog({ title: '[ applyPerception - getSetupTaxSubsidiary ]', message: e, relatedScript: LMRY_SCRIPT_NAME });
    }
  }

  /*******************************************************************************************
  * Obtención del ExchangeRate de la transaccion o Multibook para la conversión a moneda base
  *    - recordObj: Objeto record
  *    - subsidiary: Subsidiaria
  *    - setupSubsidiary: Objeto de Setup Tax Subsidiary
  *******************************************************************************************/
  function getExchangeRate (recordObj, subsidiary, setupSubsidiary){
    try {
      var exchangeRate = 1;
      // log.error("featureMB, featureSubs", FEATURE_MULTIBOOK + ", " + FEATURE_SUBSIDIARIES)

      var currency_setup = setupSubsidiary['currency'];
      var currency_invoice = recordObj.getValue("currency");
      var currency_subsidiary = "";
      if (FEATURE_SUBSIDIARIES) {
        currency_subsidiary = search.lookupFields({ type: "subsidiary", id: subsidiary, columns: ['currency'] });
        currency_subsidiary = currency_subsidiary.currency[0].value;
      }
      if (currency_setup == currency_invoice) {
        exchangeRate = 1;
      }
      if (currency_setup != currency_invoice && currency_setup == currency_subsidiary) {
        exchangeRate = parseFloat(recordObj.getValue("exchangerate"));
      }
      if (currency_setup != currency_invoice && currency_setup != currency_subsidiary && FEATURE_MULTIBOOK == true) {
        var lineas_book = recordObj.getLineCount({ sublistId: 'accountingbookdetail' });
        if (lineas_book > 0) {
          for (var k = 0; k < lineas_book; k++) {
            var currency_book = recordObj.getSublistValue({ sublistId: 'accountingbookdetail', fieldId: 'currency', line: k });
            if (currency_book == currency_setup) {
              exchangeRate = parseFloat(recordObj.getSublistValue({ sublistId: 'accountingbookdetail', fieldId: 'exchangerate', line: k }));
              break;
            }
          }
        }
      }
      return exchangeRate;
    } catch(e){
      log.error("[ applyPerception - getExchangeRate ]", e);
      library.sendemail(' [ applyPerception - getExchangeRate] ' + e, LMRY_script);
      Library_Log.doLog({ title: '[ applyPerception - getExchangeRate ]', message: e, relatedScript: LMRY_SCRIPT_NAME });
    }
  }

  /***************************************************************************
  * BUSQUEDA DEL RECORD: LATAMREADY - CONTRIBUTORY CLASS
  *    - subsidiary: Subsiaria
  *    - transactionDate: Fecha de creación de la transacción
  *    - filtroTransactionType: Invoice / Credit Memo
  *    - entity: ID de la Entidad
  *    - documentType: Tipo de Documento Fiscal
  ***************************************************************************/
  function getContributoryClasses (subsidiary, transactionDate, filtroTransactionType, entity, documentType, RespType) {
    try {
      var filtrosCC = [
        ["isinactive", "is", "F"],
        "AND",
        ["custrecord_lmry_ar_ccl_fechdesd", "onorbefore", transactionDate],
        "AND",
        ["custrecord_lmry_ar_ccl_fechhast", "onorafter", transactionDate],
        "AND",
        ["custrecord_lmry_ccl_transactiontypes", "anyof", filtroTransactionType],
        "AND",
        ["custrecord_lmry_ar_ccl_entity", "anyof", entity],
        "AND",
        ["custrecord_lmry_ccl_taxtype", "anyof", "2"], //1:Retencion, 2:Percepcion, 3:Detraccion, 4:Calculo de Impuesto
        "AND",
        ["custrecord_lmry_ccl_gen_transaction", "anyof", "4"], //1:Journal, 2:SuiteGL, 3:LatamTax(Purchase), 4:Add Line, 5: WhtbyTrans, 6: LatamTax (Sales)
        "AND",
        ['custrecord_lmry_ar_ccl_resptype', 'anyof', RespType]
      ];
      var documents = ["@NONE@"];
      if (documentType) {
        documents.push(documentType);
      }
      filtrosCC.push("AND", ["custrecord_lmry_ccl_fiscal_doctype", "anyof", documents]);
      if (FEATURE_SUBSIDIARIES) {
        filtrosCC.push("AND", ["custrecord_lmry_ar_ccl_subsidiary", "anyof", subsidiary]);
      }
      var searchCC = search.create({
        type: "customrecord_lmry_ar_contrib_class",
        columns: [
          "custrecord_lmry_ar_ccl_taxrate",
          "custrecord_lmry_ar_ccl_department",
          "custrecord_lmry_ar_ccl_class",
          "custrecord_lmry_ar_ccl_location",
          "custrecord_lmry_ccl_applies_to_account",
          "custrecord_lmry_ar_ccl_taxitem",
          "custrecord_lmry_ccl_description",
          "custrecord_lmry_ccl_appliesto",
          "custrecord_lmry_ar_ccl_jurisdib",
          "custrecord_lmry_ar_normas_iibb",
          search.createColumn({name: 'subtype', join: 'custrecord_lmry_ar_ccl_taxitem'}),
          search.createColumn({name: 'custrecord_lmry_ar_wht_regimen', join:  'custrecord_lmry_ar_regimen'}),
          "custrecord_lmry_ccl_applies_to_item",
          "custrecord_lmry_ar_ccl_taxcode"
        ],
        filters: filtrosCC,
      });
      var searchResultCC = searchCC.run().getRange({start: 0,end: 1000});
      return searchResultCC;
    }
    catch (e) {
      log.error("[ applyPerception - getContributoryClasses ]", e);
      library.sendemail(' [ applyPerception - getContributoryClasses] ' + e, LMRY_script);
      Library_Log.doLog({ title: '[ applyPerception - getContributoryClasses ]', message: e, relatedScript: LMRY_SCRIPT_NAME });
    }
  }

  /***************************************************************************
  * BUSQUEDA DEL RECORD: LATAMREADY - NATIONAL TAX
  *    - subsidiary: Subsiaria
  *    - transactionDate: Fecha de creación de la transacción
  *    - filtroTransactionType: Invoice / Credit Memo
  *    - documentType: Tipo de Documento Fiscal
  ***************************************************************************/
  function getNationalTaxes (subsidiary, transactionDate, filtroTransactionType, documentType, RespType) {
    try {
      var filtrosNT = [
        ["isinactive", "is", "F"],
        "AND",
        ["custrecord_lmry_ntax_datefrom", "onorbefore", transactionDate],
        "AND",
        ["custrecord_lmry_ntax_dateto", "onorafter", transactionDate],
        "AND",
        ["custrecord_lmry_ntax_transactiontypes", "anyof", filtroTransactionType],
        "AND",
        ["custrecord_lmry_ntax_taxtype", "anyof", "2"],
        "AND",
        ["custrecord_lmry_ntax_gen_transaction", "anyof", "4"],
      ];

      var documents = ["@NONE@"];
      if (documentType) {
        documents.push(documentType);
      }
      filtrosNT.push("AND", ["custrecord_lmry_ntax_fiscal_doctype", "anyof", documents]);

      var featureSubs = runtime.isFeatureInEffect({feature: "SUBSIDIARIES"});

      if (featureSubs) {
        filtrosNT.push("AND", ["custrecord_lmry_ntax_subsidiary", "anyof", subsidiary]);
      }

      var searchNT = search.create({
        type: "customrecord_lmry_national_taxes",
        columns: [
          "custrecord_lmry_ntax_taxrate",
          "custrecord_lmry_ntax_department",
          "custrecord_lmry_ntax_class",
          "custrecord_lmry_ntax_location",
          "custrecord_lmry_ntax_applies_to_account",
          "custrecord_lmry_ntax_taxitem",
          "custrecord_lmry_ntax_description",
          "custrecord_lmry_ntax_appliesto",
          "custrecord_lmry_ntax_jurisdib",
          "custrecord_lmry_ntax_iibb_norma",
          search.createColumn({ name: 'subtype', join: 'custrecord_lmry_ntax_taxitem' }),
          search.createColumn({ name: 'custrecord_lmry_ar_wht_regimen', join: 'custrecord_lmry_ntax_regimen' }),
          "custrecord_lmry_ntax_applies_to_item",
          "custrecord_lmry_ntax_taxcode"
        ],
        filters: filtrosNT,
      });
      var searchResultNT = searchNT.run().getRange({
        start: 0,
        end: 1000,
      });
      return searchResultNT;
    }
    catch (e) {
      log.error("[ applyPerception - getNationalTaxes ]", e);
      library.sendemail(' [ applyPerception - getNationalTaxes] ' + e, LMRY_script);
      Library_Log.doLog({ title: '[ applyPerception - getNationalTaxes ]', message: e, relatedScript: LMRY_SCRIPT_NAME });
    }
  }

  function addItem(result_CCNT, recordObj, tipoRedondeo, segmentacion) {
    try {
      
      var taxTotal = recordObj.getValue("taxtotal");
      if (taxTotal == "" || taxTotal == undefined) {
        taxTotal = 0;
      } 
      
      var amount_base = parseFloat(recordObj.getValue("total")) - parseFloat(taxTotal);
      log.debug("total", recordObj.getValue("total"));
      log.debug("taxTotal", taxTotal);

      var department_setup = segmentacion[0];
      var class_setup = segmentacion[1];
      var location_setup = segmentacion[2];

      var lastDetailLine = recordObj.getLineCount({sublistId: "taxdetails"});

      if (result_CCNT != null && result_CCNT.length > 0) {
        for (var i = 0; i < result_CCNT.length; i++) {
          var row = result_CCNT[i].columns;

          var tax_rate = result_CCNT[i].getValue(row[0]); // Latam AR - Tax rate
          var r_department = result_CCNT[i].getValue(row[1]);
          var r_class = result_CCNT[i].getValue(row[2]);
          var r_location = result_CCNT[i].getValue(row[3]);
          var applies_account = result_CCNT[i].getValue(row[4]);
          var tax_item = result_CCNT[i].getValue(row[5]); // Latam AR - Tax item
          var description = result_CCNT[i].getValue(row[6]);
          var applies_to_CCNT = result_CCNT[i].getValue(row[7]);
          var juriisibb = result_CCNT[i].getValue(row[8]); // Latam AR - IIBB Jurisdiction
          var iibbnorma = result_CCNT[i].getValue(row[9]); // Latam AR - IIBB Norma
          var itmsubtype = result_CCNT[i].getValue(row[10]); // Item SubType
          var regimenen = result_CCNT[i].getValue(row[11]); // Latam AR - Regimen
          var applies_to_item = result_CCNT[i].getValue(row[12]);
          var taxCode = result_CCNT[i].getValue(row[13]);

          var taxType = search.lookupFields({type: 'salestaxitem', id: taxCode, columns: ["taxtype"]});
          taxType = taxType.taxtype[0].value;

          if (description == null) {
            description = '';
          }

          // log.error("itmsubtype", itmsubtype)
          // Valida si es articulo para las ventas
          // if (itmsubtype != 'Para la venta' && itmsubtype != 'For Purchase' && itmsubtype != 'Para reventa' && itmsubtype != 'For Resale') {
          //   continue;
          // }

          if (amount_base <= 0) {
            continue;
          }

          // PERCEPCION
          var percepcion = 0;
          percepcion = parseFloat(amount_base) * parseFloat(tax_rate);
          var aux_cadena = percepcion + ";";
  
          if (tipoRedondeo == '1') {
            if (parseFloat(percepcion) - parseInt(percepcion) < 0.5) {
              percepcion = parseInt(percepcion);
            }
            else {
              percepcion = parseInt(percepcion) + 1;
            }
          }
          if (tipoRedondeo == '2') {
            percepcion = parseInt(percepcion);
          }

          if (applies_account != '' && applies_account != null) {
            aux_cadena += applies_account;
          }
  
          percepcion = parseFloat(Math.round(parseFloat(percepcion) * 100) / 100);
  
          recordObj.selectNewLine('item');

          recordObj.setCurrentSublistValue('item', 'item', tax_item);
          recordObj.setCurrentSublistValue('item', 'description', description);
          recordObj.setCurrentSublistValue('item', 'quantity', 1);
          recordObj.setCurrentSublistValue('item', 'rate', 0);
          recordObj.setCurrentSublistValue('item', 'custcol_lmry_ar_perception_percentage', parseFloat(tax_rate)*100);
          recordObj.setCurrentSublistValue('item', 'custcol_lmry_ar_item_tributo', true);
          recordObj.setCurrentSublistValue('item', 'custcol_lmry_base_amount', amount_base);

          // Name: Latam Col - AR Jurisdiccion IIBB
          if (juriisibb != '' && juriisibb != null) {
            recordObj.setCurrentSublistValue('item', 'custcol_lmry_ar_col_jurisd_iibb', juriisibb);
          }

          // Department
          if (FEATURE_DEPARTMENT || FEATURE_DEPARTMENT == 'T') {
            if (r_department != '' && r_department != null) {
              recordObj.setCurrentSublistValue('item', 'department', r_department);
            } else {
              if (MANDATORY_DEPARTMENT || MANDATORY_DEPARTMENT == 'T') {
                recordObj.setCurrentSublistValue('item', 'department', department_setup);
              }
            }
          }

          // Class
          if (FEATURE_CLASSES || FEATURE_CLASSES == 'T') {
            if (r_class != '' && r_class != null) {
              recordObj.setCurrentSublistValue('item', 'class', r_class);
            } else {
              if (MANDATORY_CLASS || MANDATORY_CLASS == 'T') {
                recordObj.setCurrentSublistValue('item', 'class', class_setup);
              }
            }
          }

          var fieldLocation = recordObj.getSublistField({ sublistId: 'item', fieldId: 'location', line: numLines });

          // Location
          if (fieldLocation != '' && fieldLocation != null && (FEATURE_LOCATIONS || FEATURE_LOCATIONS == 'T')) {
            if (r_location != '' && r_location != null) {
              recordObj.setCurrentSublistValue('item', 'location', r_location);
            } else {
              if (MANDATORY_LOCATION || MANDATORY_LOCATION == 'T') {
                recordObj.setCurrentSublistValue('item', 'location', location_setup);
              }
            }
          }

          recordObj.commitLine({sublistId: 'item'});
          
          var itemDetailReference = recordObj.getSublistValue({ sublistId: 'item', fieldId: 'taxdetailsreference', line: numLines });

          recordObj.selectNewLine('taxdetails');
          // log.error("percepcion", percepcion)
          recordObj.setCurrentSublistValue({ sublistId: "taxdetails", fieldId: "taxdetailsreference", value: itemDetailReference });
          recordObj.setCurrentSublistValue({ sublistId: "taxdetails", fieldId: "taxtype", value: taxType });
          recordObj.setCurrentSublistValue({ sublistId: "taxdetails", fieldId: "taxcode",  value: taxCode });
          recordObj.setCurrentSublistValue({ sublistId: "taxdetails", fieldId: "taxbasis",  value: amount_base });
          recordObj.setCurrentSublistValue({ sublistId: "taxdetails", fieldId: "taxrate",  value: parseFloat(tax_rate) * 100 });
          recordObj.setCurrentSublistValue({ sublistId: "taxdetails", fieldId: "taxamount", value: parseFloat(percepcion) });
          
          // log.error("itemDetailReference", itemDetailReference)
          // log.error("taxtype", taxType)
          // log.error("taxcode", taxCode)
          // log.error("taxbasis", amount_base)
          // log.error("taxrate", tax_rate)
          // log.error("taxamount", percepcion)
          recordObj.commitLine({sublistId: 'taxdetails'});


          // Incrementa las lineas
          lastDetailLine++;
          numLines++;
        }
      }
    }
    catch (e) {
      log.error("[ applyPerception - addItem ]", e);
      library.sendemail(' [ applyPerception - addItem] ' + e, LMRY_script);
      Library_Log.doLog({ title: '[ applyPerception - addItem ]', message: e, relatedScript: LMRY_SCRIPT_NAME });
    }

  }

  function deleteTaxItemLines(recordObj) {
    try {

      while (true) {
        
        var itemLineCount = recordObj.getLineCount({ sublistId:"item"});

        for (var i = 0; i < itemLineCount; i++) {
          var isItemTax = recordObj.getSublistValue({ sublistId: "item", fieldId: "custcol_lmry_ar_item_tributo", line: i });

          if (isItemTax == true || isItemTax == "T") {
            recordObj.removeLine({ sublistId: "item", line: i });
            break;
          }

        }

        if ( i == itemLineCount) {
          break;
        }

      }

    }
    catch(e){
      log.error("[ deleteTaxItemLines ]", e);
      library.sendemail('[ deleteTaxItemLines ]: ' + e, LMRY_script);
      Library_Log.doLog({title: '[ deleteTaxItemLines ]', message: e, relatedScript: LMRY_SCRIPT_NAME});
    }
  }
  
  return {
    applyPerception: applyPerception,
  };

});
